import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "crypto";

import { getIntegrationsEnv } from "@/lib/env";

const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const env = getIntegrationsEnv();
  const key = Buffer.from(env.INTEGRATIONS_ENCRYPTION_KEY, "base64");
  if (key.length !== 32) {
    throw new Error("INTEGRATIONS_ENCRYPTION_KEY must decode to 32 bytes");
  }
  return key;
}

export function encryptToken(plaintext: string): Buffer {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv) as CipherGCM;
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]);
}

export function decryptToken(payload: Buffer): string {
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Encrypted payload is too short");
  }
  const key = getKey();
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv) as DecipherGCM;
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
