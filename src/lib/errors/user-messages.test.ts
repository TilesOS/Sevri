import assert from "node:assert/strict";
import test from "node:test";
import { RATE_LIMITED_MESSAGE, isRateLimited, toUserFacingError } from "./user-messages.ts";

const FALLBACK = "Something went wrong. Try again in a moment.";

test("raw rate-limit strings never reach a user", () => {
  assert.equal(toUserFacingError("Rate limit exceeded", FALLBACK), RATE_LIMITED_MESSAGE);
  assert.equal(toUserFacingError("rate limit exceeded", FALLBACK), RATE_LIMITED_MESSAGE);
  assert.equal(toUserFacingError("Too many requests", FALLBACK), RATE_LIMITED_MESSAGE);
});

test("the rate-limit message avoids internal vocabulary", () => {
  assert.ok(!/rate limit/i.test(RATE_LIMITED_MESSAGE));
  assert.ok(RATE_LIMITED_MESSAGE.length > 0);
});

test("supabase auth strings are rewritten", () => {
  assert.equal(
    toUserFacingError("Invalid login credentials", FALLBACK),
    "That email and password don't match. Check both and try again.",
  );
  assert.equal(
    toUserFacingError("Email not confirmed", FALLBACK),
    "Confirm your email address first — check your inbox for the link we sent.",
  );
});

test("variable detail is preserved through pattern rewrites", () => {
  assert.equal(
    toUserFacingError("Password should be at least 8 characters", FALLBACK),
    "Choose a password with at least 8 characters.",
  );
});

test("missing or empty messages use the fallback", () => {
  assert.equal(toUserFacingError(null, FALLBACK), FALLBACK);
  assert.equal(toUserFacingError(undefined, FALLBACK), FALLBACK);
  assert.equal(toUserFacingError("", FALLBACK), FALLBACK);
  assert.equal(toUserFacingError("   ", FALLBACK), FALLBACK);
  assert.equal(toUserFacingError(42, FALLBACK), FALLBACK);
});

test("diagnostic-looking strings fall back instead of leaking", () => {
  assert.equal(toUserFacingError("PGRST116", FALLBACK), FALLBACK);
  assert.equal(toUserFacingError("invalid_request_error", FALLBACK), FALLBACK);
  assert.equal(toUserFacingError('{"code":"22P02"}', FALLBACK), FALLBACK);
  assert.equal(toUserFacingError("at handler (/app/route.ts:12)", FALLBACK), FALLBACK);
  assert.equal(toUserFacingError("Cannot read properties of undefined", FALLBACK), FALLBACK);
  assert.equal(toUserFacingError("lowercase without capital", FALLBACK), FALLBACK);
});

test("database internals fall back to reassuring copy", () => {
  const message = toUserFacingError('new row violates row-level security constraint "x"', FALLBACK);
  assert.ok(!message.includes("row-level security"));
});

test("AI provider and configured-model internals use contextual fallback copy", () => {
  const fallback = "We couldn't generate an idea board. Check your connection and try again.";
  assert.equal(
    toUserFacingError(
      "AI generation is temporarily unavailable because the configured model is not enabled for this project.",
      fallback,
    ),
    fallback,
  );
});

test("copy already written for a person passes through untouched", () => {
  const written = "Finish Step 2 before opening guidance for this step.";
  assert.equal(toUserFacingError(written, FALLBACK), written);
});

test("Error instances are unwrapped", () => {
  assert.equal(toUserFacingError(new Error("Rate limit exceeded"), FALLBACK), RATE_LIMITED_MESSAGE);
});

test("very long messages fall back rather than dumping a payload", () => {
  assert.equal(toUserFacingError(`A${"b".repeat(400)}`, FALLBACK), FALLBACK);
});

test("rate limiting is detected by status or by body code", () => {
  assert.equal(isRateLimited(429), true);
  assert.equal(isRateLimited(200, "rate_limited"), true);
  assert.equal(isRateLimited(500, "server_error"), false);
  assert.equal(isRateLimited(200), false);
});
