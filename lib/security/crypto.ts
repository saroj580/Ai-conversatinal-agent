import crypto from "crypto";

/**
 * Encrypt/decrypt small secrets (OAuth refresh tokens, API keys, etc.) for storage in DB.
 *
 * Uses AES-256-GCM with a single app-level key.
 *
 * Env:
 * - APP_CREDENTIAL_ENCRYPTION_KEY: base64-encoded 32-byte key
 */

function getKey(): Buffer {
  const b64 = process.env.APP_CREDENTIAL_ENCRYPTION_KEY;
  if (!b64) {
    throw new Error("Missing APP_CREDENTIAL_ENCRYPTION_KEY");
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) {
    throw new Error("APP_CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (base64)");
  }
  return key;
}

type EncryptedBlobV1 = {
  v: 1;
  alg: "aes-256-gcm";
  iv: string; // base64
  tag: string; // base64
  data: string; // base64
};

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const blob: EncryptedBlobV1 = {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64"),
  };

  return JSON.stringify(blob);
}

export function decryptSecret(encryptedBlob: string): string {
  const parsed = JSON.parse(encryptedBlob) as EncryptedBlobV1;
  if (!parsed || parsed.v !== 1 || parsed.alg !== "aes-256-gcm") {
    throw new Error("Unsupported encrypted secret format");
  }

  const iv = Buffer.from(parsed.iv, "base64");
  const tag = Buffer.from(parsed.tag, "base64");
  const data = Buffer.from(parsed.data, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}


