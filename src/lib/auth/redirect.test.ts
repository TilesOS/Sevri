import assert from "node:assert/strict";
import test from "node:test";
import { getSafeRedirectPath, isSafeRedirectPath } from "./redirect.ts";

test("accepts same-origin application paths", () => {
  const safeValues = [
    "/",
    "/dashboard",
    "/project/123",
    "/reset-password?from=email#password",
    "/search?q=hello%20world",
    "/projects/%E2%9C%93",
  ];

  for (const value of safeValues) {
    assert.equal(isSafeRedirectPath(value), true, value);
    assert.equal(getSafeRedirectPath(value), value);
  }
});

test("rejects external, executable, normalized, and malformed redirect values", () => {
  const unsafeValues = [
    null,
    "",
    "dashboard",
    "https://evil.example",
    "javascript:alert(1)",
    "//evil.example",
    "///evil.example",
    "\\\\evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/%2f%2fevil.example",
    "/%252f%252fevil.example",
    "/bad%",
    "/bad%2",
    "/\nevil.example",
    "/\u0000evil.example",
  ];

  for (const value of unsafeValues) {
    assert.equal(isSafeRedirectPath(value), false, String(value));
    assert.equal(getSafeRedirectPath(value), "/dashboard");
  }
});

test("supports a caller-provided fallback", () => {
  assert.equal(getSafeRedirectPath("//evil.example", "/sign-in"), "/sign-in");
});
