import { createHash } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Rate limiting for auth requests made before a user is known — today, password
 * recovery. `enforceRateLimit` in rate-limit.ts keys on a user id, which does
 * not exist yet here, so these requests are counted in `auth_rate_limits`
 * instead and keyed by a digest of the email address or client IP.
 */

/** Namespaced so a digest stored here cannot be matched against one made elsewhere. */
const KEY_NAMESPACE = "sevri:auth-rate-limit:v1:";

interface AuthRateLimitInput {
  /** Which limit this is, e.g. "password_recovery_email". */
  bucket: string;
  /** The raw identifier being limited. Never stored — only its digest is. */
  key: string;
  maxRequests: number;
  windowMinutes: number;
}

export interface AuthRateLimitResult {
  allowed: boolean;
  /** How long the caller should wait, for the "try again in N" message. */
  retryAfterSeconds: number;
}

function hashKey(bucket: string, key: string) {
  return createHash("sha256").update(`${KEY_NAMESPACE}${bucket}:${key.trim().toLowerCase()}`).digest("hex");
}

/**
 * Counts prior requests in the window and records this one. Throws if the
 * ledger itself is unreachable, so callers decide whether a broken limiter
 * should block the request or let it through.
 */
export async function enforceAuthRateLimit(input: AuthRateLimitInput): Promise<AuthRateLimitResult> {
  const supabase = createAdminSupabaseClient();
  const windowStart = new Date(Date.now() - input.windowMinutes * 60_000).toISOString();
  const keyHash = hashKey(input.bucket, input.key);
  const retryAfterSeconds = input.windowMinutes * 60;

  const { count, error } = await supabase
    .from("auth_rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", input.bucket)
    .eq("key_hash", keyHash)
    .gte("created_at", windowStart);

  if (error) {
    throw new Error(`Auth rate limit check failed: ${error.message}`);
  }

  if ((count ?? 0) >= input.maxRequests) {
    return { allowed: false, retryAfterSeconds };
  }

  const { error: insertError } = await supabase
    .from("auth_rate_limits")
    .insert({ bucket: input.bucket, key_hash: keyHash });

  if (insertError) {
    throw new Error(`Auth rate limit track failed: ${insertError.message}`);
  }

  return { allowed: true, retryAfterSeconds };
}
