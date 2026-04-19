// Manual verification for AES-256-GCM token encryption.
// Run with: npx tsx scripts/verify-encryption.ts
// Requires INTEGRATIONS_ENCRYPTION_KEY in env.

import { encryptToken, decryptToken } from "@/lib/integrations/github/encryption";

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function main() {
  const fixture = "ghp_testing_fixture_1234567890";

  const ct1 = encryptToken(fixture);
  const pt1 = decryptToken(ct1);
  assert(pt1 === fixture, "round-trip equality");

  const ct2 = encryptToken(fixture);
  assert(!ct1.equals(ct2), "IV freshness — two encryptions must differ");

  const tampered = Buffer.from(ct1);
  tampered[tampered.length - 1] ^= 0xff;
  let threw = false;
  try {
    decryptToken(tampered);
  } catch {
    threw = true;
  }
  assert(threw, "tampered ciphertext must throw on auth-tag mismatch");

  console.log("OK — encryption round-trip, IV freshness, tamper detection");
}

main();
