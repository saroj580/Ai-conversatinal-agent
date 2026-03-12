import { prisma } from "@/lib/db/prisma";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";

/**
 * Generic OAuth token manager.
 *
 * Provides helpers to read, check expiry, and update credentials stored in the
 * AppCredential table. App-specific OAuth clients (Google, etc.) use this to
 * avoid duplicating DB logic.
 */

/** Buffer (ms) before actual expiry to treat a token as expired (1 min) */
const EXPIRY_BUFFER_MS = 60_000;

/**
 * Retrieve a decrypted credential value for a connected app.
 * Returns null if not found.
 */
export async function getCredential(
  connectedAppId: string,
  type: string,
): Promise<{ value: string; expiresAt: Date | null } | null> {
  const cred = await prisma.appCredential.findUnique({
    where: { connectedAppId_type: { connectedAppId, type } },
  });
  if (!cred) return null;
  return {
    value: decryptSecret(cred.encryptedValue),
    expiresAt: cred.expiresAt,
  };
}


// Check if a stored credential has expired (or will expire within the buffer).
export function isExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() < Date.now() + EXPIRY_BUFFER_MS;
}


// Upsert a credential (encrypts the plain-text value before storing).

export async function upsertCredential(
  connectedAppId: string,
  type: string,
  plainValue: string,
  expiresAt?: Date | null,
) {
  await prisma.appCredential.upsert({
    where: { connectedAppId_type: { connectedAppId, type } },
    create: {
      connectedAppId,
      type,
      encryptedValue: encryptSecret(plainValue),
      expiresAt: expiresAt ?? null,
    },
    update: {
      encryptedValue: encryptSecret(plainValue),
      expiresAt: expiresAt ?? null,
    },
  });
}


// Delete all credentials for a connected app.

export async function deleteCredentials(connectedAppId: string) {
  await prisma.appCredential.deleteMany({
    where: { connectedAppId },
  });
}
