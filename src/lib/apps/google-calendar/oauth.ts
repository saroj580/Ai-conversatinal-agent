import crypto from "crypto";
import { google } from "googleapis";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret, decryptSecret } from "@/lib/security/crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

/** Max age (ms) for the OAuth state parameter — 10 minutes */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXT_PUBLIC_APP_URL",
    );
  }

  const redirectUri = `${appUrl}/api/apps/google-calendar/callback`;
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

type StatePayload = {
  userId: string;
  iat: number;
};

function signState(payload: StatePayload) {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("Missing GOOGLE_OAUTH_STATE_SECRET");
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyState(state: string): StatePayload {
  const secret = process.env.GOOGLE_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("Missing GOOGLE_OAUTH_STATE_SECRET");
  const [data, sig] = state.split(".");
  if (!data || !sig) throw new Error("Invalid OAuth state");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error("Invalid OAuth state signature");
  }
  const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as StatePayload;
  if (!payload?.userId) throw new Error("Invalid OAuth state payload");

  // Reject stale state tokens
  const age = Date.now() - payload.iat;
  if (age > STATE_MAX_AGE_MS) {
    throw new Error("OAuth state expired — please try connecting again");
  }

  return payload;
}

export async function generateGoogleAuthUrl({ userId }: { userId: string }) {
  const oauth2 = getOAuthClient();
  const state = signState({ userId, iat: Date.now() });

  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function handleGoogleOAuthCallback({
  code,
  state,
}: {
  code: string;
  state: string;
}) {
  const { userId } = verifyState(state);
  const oauth2 = getOAuthClient();

  const { tokens } = await oauth2.getToken(code);
  const refreshToken = tokens.refresh_token;
  const accessToken = tokens.access_token;

  if (!refreshToken) {
    throw new Error("Google did not return a refresh token. Reconnect with prompt=consent.");
  }

  const connectedApp = await prisma.connectedApp.upsert({
    where: { userId_appId: { userId, appId: "google-calendar" } },
    create: { userId, appId: "google-calendar", status: "connected" },
    update: { status: "connected" },
  });

  // Store refresh token (long-lived, encrypted)
  await prisma.appCredential.upsert({
    where: { connectedAppId_type: { connectedAppId: connectedApp.id, type: "refresh_token" } },
    create: {
      connectedAppId: connectedApp.id,
      type: "refresh_token",
      encryptedValue: encryptSecret(refreshToken),
    },
    update: {
      encryptedValue: encryptSecret(refreshToken),
    },
  });

  // Store access token (short-lived ~1 hr, encrypted) with its expiry
  if (accessToken) {
    await prisma.appCredential.upsert({
      where: { connectedAppId_type: { connectedAppId: connectedApp.id, type: "access_token" } },
      create: {
        connectedAppId: connectedApp.id,
        type: "access_token",
        encryptedValue: encryptSecret(accessToken),
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
      update: {
        encryptedValue: encryptSecret(accessToken),
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });
  }

  return { userId };
}

/**
 * Returns an authenticated OAuth2 client for a given user.
 *
 * Flow:
 * 1. Load stored credentials (access_token + refresh_token) from DB
 * 2. If access_token exists and hasn't expired, set it directly (avoids a round-trip)
 * 3. Otherwise, set only the refresh_token — googleapis will auto-refresh
 * 4. Listen for the "tokens" event to persist any newly refreshed access token
 */
export async function getGoogleOAuthClientForUser(userId: string) {
  const oauth2 = getOAuthClient();

  const connected = await prisma.connectedApp.findUnique({
    where: { userId_appId: { userId, appId: "google-calendar" } },
    include: { credentials: true },
  });

  const refreshCred = connected?.credentials.find((c) => c.type === "refresh_token");
  if (!refreshCred) throw new Error("Google Calendar not connected");

  const refreshToken = decryptSecret(refreshCred.encryptedValue);

  // Check for a cached access token that hasn't expired yet
  const accessCred = connected?.credentials.find((c) => c.type === "access_token");
  let accessToken: string | undefined;

  if (accessCred) {
    const isExpired = accessCred.expiresAt
      ? accessCred.expiresAt.getTime() < Date.now() + 60_000 // 1 min buffer
      : true;

    if (!isExpired) {
      accessToken = decryptSecret(accessCred.encryptedValue);
    }
  }

  oauth2.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
  });

  // When googleapis refreshes the token, persist the new access token to DB
  oauth2.on("tokens", async (tokens) => {
    if (!tokens.access_token || !connected) return;

    try {
      await prisma.appCredential.upsert({
        where: {
          connectedAppId_type: { connectedAppId: connected.id, type: "access_token" },
        },
        create: {
          connectedAppId: connected.id,
          type: "access_token",
          encryptedValue: encryptSecret(tokens.access_token),
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
        update: {
          encryptedValue: encryptSecret(tokens.access_token),
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });
    } catch {
      // Token persistence is best-effort — next request will refresh again
    }
  });

  return oauth2;
}

/**
 * Revoke the user's Google tokens and delete stored credentials.
 * Best-effort: if the revoke call to Google fails, we still remove local credentials.
 */
export async function revokeGoogleTokens(userId: string) {
  const connected = await prisma.connectedApp.findUnique({
    where: { userId_appId: { userId, appId: "google-calendar" } },
    include: { credentials: true },
  });
  if (!connected) return;

  // Try to revoke at Google
  const refreshCred = connected.credentials.find((c) => c.type === "refresh_token");
  if (refreshCred) {
    try {
      const oauth2 = getOAuthClient();
      const token = decryptSecret(refreshCred.encryptedValue);
      await oauth2.revokeToken(token);
    } catch {
      // Revocation is best-effort — token may already be invalid
    }
  }

  // Delete all stored credentials for this app
  await prisma.appCredential.deleteMany({
    where: { connectedAppId: connected.id },
  });
}

