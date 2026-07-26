import assert from "node:assert/strict";
import test from "node:test";
import { hashRateLimitKey } from "./rate-limit-key.ts";

test("rate-limit keys are normalized and never contain the raw identifier", () => {
  const raw = " Student@Example.COM ";
  const digest = hashRateLimitKey("password_recovery_email", raw);

  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(
    digest,
    hashRateLimitKey("password_recovery_email", "student@example.com"),
  );
  assert.equal(digest.includes("student"), false);
  assert.equal(digest.includes("@"), false);
});

test("the bucket namespaces identical identifiers", () => {
  const raw = "203.0.113.9";

  assert.notEqual(
    hashRateLimitKey("password_recovery_ip", raw),
    hashRateLimitKey("password_recovery_email", raw),
  );
});
