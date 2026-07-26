import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashRateLimitKey } from "@/lib/usage/rate-limit-key";
import { RateLimitUnavailableError } from "@/lib/usage/rate-limit";

interface RecommendationQuotaRow {
  allowed: boolean;
  reservation_id: string | null;
  generations_used: number;
  remaining: number;
  reset_at: string | null;
  retry_after_seconds: number;
}

export interface RecommendationQuotaReservation {
  allowed: boolean;
  reservationId: string | null;
  generationsUsed: number;
  remaining: number;
  resetAt: string | null;
  retryAfterSeconds: number;
}

/**
 * Atomically combines persisted recommendation batches with in-flight claims.
 * This is the free-plan entitlement gate and must run before the first model
 * call. Persisted batches remain the durable source of truth after success.
 */
export async function reserveRecommendationGeneration(
  userId: string,
  generationLimit: number,
): Promise<RecommendationQuotaReservation> {
  const supabase = createAdminSupabaseClient();
  const bucket = "recommendation_generation_entitlement";
  const { data, error } = await supabase
    .rpc("claim_recommendation_generation", {
      p_user_id: userId,
      p_key_hash: hashRateLimitKey(bucket, userId),
      p_generation_limit: generationLimit,
      p_reservation_ttl_seconds: 1800,
    })
    .single();

  if (error) {
    throw new RateLimitUnavailableError(
      `Recommendation quota reservation failed: ${error.message}`,
    );
  }

  if (!data) {
    throw new RateLimitUnavailableError(
      "Recommendation quota reservation returned no result",
    );
  }

  const row = data as RecommendationQuotaRow;
  return {
    allowed: row.allowed,
    reservationId: row.reservation_id,
    generationsUsed: row.generations_used,
    remaining: row.remaining,
    resetAt: row.reset_at,
    retryAfterSeconds: row.retry_after_seconds,
  };
}
