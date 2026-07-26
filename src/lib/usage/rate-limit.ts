import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashRateLimitKey } from "@/lib/usage/rate-limit-key";

export interface RateLimitInput {
  userId: string;
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
  /** Abandoned work stops occupying a slot after this many seconds. */
  reservationTtlSeconds?: number;
}

interface RateLimitResultFields {
  remaining: number;
  resetAt: string | null;
  retryAfterSeconds: number;
}

export type RateLimitResult =
  | (RateLimitResultFields & { allowed: true; reservationId: string })
  | (RateLimitResultFields & { allowed: false; reservationId: null });

interface ClaimRow {
  allowed: boolean;
  reservation_id: string | null;
  remaining: number;
  reset_at: string | null;
  retry_after_seconds: number;
}

export class RateLimitUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitUnavailableError";
  }
}

/**
 * Claims a slot in one database transaction. Postgres serializes claims for a
 * bucket/key pair, so callers must receive a reservation before starting any
 * model call, email, export, or other cost-bearing work.
 *
 * Limiter errors intentionally throw. Cost-bearing routes fail closed: a short
 * availability loss is preferable to unbounded OpenAI/email/external-API spend.
 */
export async function enforceRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const supabase = createAdminSupabaseClient();
  const bucket = `rate_limit:${input.endpoint}`;
  const { data, error } = await supabase
    .rpc("claim_rate_limit_reservation", {
      p_bucket: bucket,
      p_key_hash: hashRateLimitKey(bucket, input.userId),
      p_max_requests: input.maxRequests,
      p_window_seconds: input.windowMinutes * 60,
      p_reservation_ttl_seconds: input.reservationTtlSeconds ?? 1800,
    })
    .single();

  if (error) {
    throw new RateLimitUnavailableError(`Atomic rate-limit claim failed: ${error.message}`);
  }

  if (!data) {
    throw new RateLimitUnavailableError("Atomic rate-limit claim returned no result");
  }

  const row = data as ClaimRow;
  if (row.allowed && !row.reservation_id) {
    throw new RateLimitUnavailableError(
      "Atomic rate-limit claim allowed work without a reservation",
    );
  }

  if (!row.allowed) {
    return {
      allowed: false,
      reservationId: null,
      remaining: row.remaining,
      resetAt: row.reset_at,
      retryAfterSeconds: row.retry_after_seconds,
    };
  }

  return {
    allowed: true,
    reservationId: row.reservation_id as string,
    remaining: row.remaining,
    resetAt: row.reset_at,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

async function finalizeRateLimitReservation(
  reservationId: string,
  consume: boolean,
  resourceId?: string,
) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("finalize_rate_limit_reservation", {
    p_reservation_id: reservationId,
    p_consume: consume,
    p_resource_id: resourceId ?? null,
  });

  if (error) {
    throw new RateLimitUnavailableError(
      `Rate-limit reservation finalization failed: ${error.message}`,
    );
  }

  if (data !== true) {
    throw new RateLimitUnavailableError(
      `Rate-limit reservation ${reservationId} was no longer active`,
    );
  }
}

/** Count a successful cost-bearing operation against the rolling limit. */
export async function consumeRateLimitReservation(reservationId: string | null, resourceId?: string) {
  if (!reservationId) {
    throw new Error("Cannot consume a missing rate-limit reservation");
  }
  await finalizeRateLimitReservation(reservationId, true, resourceId);
}

/** Release failed or abandoned work so it does not consume quota. */
export async function releaseRateLimitReservation(reservationId: string) {
  await finalizeRateLimitReservation(reservationId, false);
}
