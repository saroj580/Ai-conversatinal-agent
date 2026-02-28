import crypto from "crypto";
import { google } from "googleapis";
import { prisma } from "@/lib/db/prisma";
import { encryptSecret } from "@/lib/security/crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

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

  if (!refreshToken) {
    // If user already granted previously, Google sometimes doesn't return refresh_token.
    // In production you can treat this as "already connected" if refresh_token exists.
    throw new Error("Google did not return a refresh token. Reconnect with prompt=consent.");
  }

  const connectedApp = await prisma.connectedApp.upsert({
    where: { userId_appId: { userId, appId: "google-calendar" } },
    create: { userId, appId: "google-calendar", status: "connected" },
    update: { status: "connected" },
  });

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

  return { userId };
}

export async function getGoogleOAuthClientForUser(userId: string) {
  const oauth2 = getOAuthClient();

  const connected = await prisma.connectedApp.findUnique({
    where: { userId_appId: { userId, appId: "google-calendar" } },
    include: { credentials: true },
  });

  const refresh = connected?.credentials.find((c) => c.type === "refresh_token");
  if (!refresh) throw new Error("Google Calendar not connected");

  // Decrypt in actions.ts to avoid importing crypto there; keeping simple here:
  // Better: decrypt here too. We'll do it here for a single source of truth.
  const { decryptSecret } = await import("@/lib/security/crypto");
  oauth2.setCredentials({ refresh_token: decryptSecret(refresh.encryptedValue) });

  return oauth2;
}


