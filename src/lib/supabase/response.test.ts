import assert from "node:assert/strict";
import test from "node:test";
import { copySessionResponseState } from "./response-state.ts";

function createResponseState() {
  const cookies: Array<{ name: string; value: string; path?: string }> = [];
  const headers = new Map<string, string>();

  return {
    cookies: {
      getAll: () => cookies,
      set: (cookie: { name: string; value: string; path?: string }) => {
        cookies.push(cookie);
      },
    },
    headers: {
      get: (name: string) => headers.get(name.toLowerCase()) ?? null,
      set: (name: string, value: string) => headers.set(name.toLowerCase(), value),
    },
  };
}

test("redirect state preserves refreshed cookies and private cache headers", () => {
  const source = createResponseState();
  const target = createResponseState();
  source.cookies.set({ name: "sb-session", value: "fresh", path: "/" });
  source.headers.set("Cache-Control", "private, no-store");
  source.headers.set("Expires", "0");
  source.headers.set("Pragma", "no-cache");
  source.headers.set("x-unrelated", "do-not-copy");

  copySessionResponseState(source, target, {
    setCookie(response, cookie) {
      response.cookies.set(cookie);
    },
    setHeader(response, name, value) {
      response.headers.set(name, value);
    },
  });

  assert.deepEqual(target.cookies.getAll(), [
    { name: "sb-session", value: "fresh", path: "/" },
  ]);
  assert.equal(target.headers.get("cache-control"), "private, no-store");
  assert.equal(target.headers.get("expires"), "0");
  assert.equal(target.headers.get("pragma"), "no-cache");
  assert.equal(target.headers.get("x-unrelated"), null);
});
