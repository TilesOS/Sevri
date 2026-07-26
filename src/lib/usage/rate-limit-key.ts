import { createHash } from "node:crypto";

const KEY_NAMESPACE = "sevri:rate-limit:v2:";

/**
 * Produces the only identifier persisted by the limiter. The namespace and
 * bucket prevent a digest copied from one limit from being correlated with a
 * digest in another; raw emails, IPs, and user identifiers never enter the
 * reservation ledger.
 */
export function hashRateLimitKey(bucket: string, rawKey: string) {
  return createHash("sha256")
    .update(`${KEY_NAMESPACE}${bucket}:${rawKey.trim().toLowerCase()}`)
    .digest("hex");
}
