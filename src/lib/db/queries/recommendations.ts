import { createServerSupabaseClient } from "@/lib/supabase/server";
import { countRecommendationBatches, type RecommendationBatchRow } from "@/lib/usage/recommendation-batches";

export async function getLatestRecommendations(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) throw new Error(`Failed to fetch recommendations: ${error.message}`);
  return data ?? [];
}

export async function getRecommendationAvailability(userId: string) {
  const supabase = await createServerSupabaseClient();
  const [{ count: intakeCount, error: intakeError }, { count: recommendationCount, error: recommendationError }] = await Promise.all([
    supabase.from("intakes").select("id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("project_recommendations").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  if (intakeError) throw new Error(`Failed to fetch intake availability: ${intakeError.message}`);
  if (recommendationError) throw new Error(`Failed to fetch recommendation availability: ${recommendationError.message}`);
  return { hasIntake: (intakeCount ?? 0) > 0, recommendationCount: recommendationCount ?? 0 };
}

/** Compatibility alias for callers that only need generation readiness. */

export async function getRecommendationGenerationCount(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("project_recommendations").select("normalized_profile_id").eq("user_id", userId);
  if (error) throw new Error(`Failed to fetch recommendation batch count: ${error.message}`);
  return countRecommendationBatches((data ?? []) as RecommendationBatchRow[]);
}
