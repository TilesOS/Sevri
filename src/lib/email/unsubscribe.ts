import { createHmac, timingSafeEqual } from "node:crypto";
import { getLifecycleEmailEnv } from "@/lib/env";

const TOKEN_VERSION = "v1";

function signature(payload: string) {
  return createHmac("sha256", getLifecycleEmailEnv().EMAIL_UNSUBSCRIBE_SECRET)
    .update(payload)
    .digest("base64url");
}

export function createUnsubscribeToken(userId: string) {
  const payload = `${TOKEN_VERSION}.${Buffer.from(userId, "utf8").toString("base64url")}`;
  return `${payload}.${signature(payload)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;

  const payload = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const userId = Buffer.from(parts[1], "base64url").toString("utf8");
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null;
}
