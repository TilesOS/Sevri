import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  consumeRateLimitReservation,
  releaseRateLimitReservation,
} from "@/lib/usage/rate-limit";
import { hashRateLimitKey } from "@/lib/usage/rate-limit-key";

/**
 * Password recovery is anonymous, so it uses opaque email/IP digests. Both
 * limits are checked and reserved in one database transaction, with the IP
 * decision evaluated first. A blocked IP therefore cannot burn address slots.
 */

interface AuthRateLimitPolicy {
  maxRequests: number;
  windowMinutes: number;
}

interface PasswordRecoveryRateLimitInput {
  email: string;
  ip: string;
  emailLimit: AuthRateLimitPolicy;
  ipLimit: AuthRateLimitPolicy;
}

interface PasswordRecoveryClaimRow {
  allowed: boolean;
  blocked_bucket: "ip" | "email" | null;
  ip_reservation_id: string | null;
  email_reservation_id: string | null;
  ip_remaining: number | null;
  email_remaining: number | null;
  reset_at: string | null;
  retry_after_seconds: number;
}

export interface PasswordRecoveryRateLimitResult {
  allowed: boolean;
  blockedBucket: "ip" | "email" | null;
  reservationIds: string[];
  ipRemaining: number | null;
  emailRemaining: number | null;
  resetAt: string | null;
  retryAfterSeconds: number;
}

/**
 * Throws when the limiter is unavailable. Password recovery fails closed so an
 * outage cannot silently turn the endpoint into an email-spend bypass.
 */
export async function reservePasswordRecoveryRateLimits(
  input: PasswordRecoveryRateLimitInput,
): Promise<PasswordRecoveryRateLimitResult> {
  const supabase = createAdminSupabaseClient();
  const ipBucket = "password_recovery_ip";
  const emailBucket = "password_recovery_email";
  const { data, error } = await supabase
    .rpc("claim_password_recovery_reservations", {
      p_ip_key_hash: hashRateLimitKey(ipBucket, input.ip),
      p_email_key_hash: hashRateLimitKey(emailBucket, input.email),
      p_ip_max_requests: input.ipLimit.maxRequests,
      p_email_max_requests: input.emailLimit.maxRequests,
      p_ip_window_seconds: input.ipLimit.windowMinutes * 60,
      p_email_window_seconds: input.emailLimit.windowMinutes * 60,
      p_reservation_ttl_seconds: 300,
    })
    .single();

  if (error) {
    throw new Error(`Atomic password-recovery rate-limit claim failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("Atomic password-recovery rate-limit claim returned no result");
  }

  const row = data as PasswordRecoveryClaimRow;

  return {
    allowed: row.allowed,
    blockedBucket: row.blocked_bucket,
    reservationIds: [row.ip_reservation_id, row.email_reservation_id].filter(
      (value): value is string => Boolean(value),
    ),
    ipRemaining: row.ip_remaining,
    emailRemaining: row.email_remaining,
    resetAt: row.reset_at,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

export async function consumePasswordRecoveryRateLimits(reservationIds: string[]) {
  await Promise.all(reservationIds.map((id) => consumeRateLimitReservation(id)));
}

export async function releasePasswordRecoveryRateLimits(reservationIds: string[]) {
  await Promise.all(reservationIds.map((id) => releaseRateLimitReservation(id)));
}
