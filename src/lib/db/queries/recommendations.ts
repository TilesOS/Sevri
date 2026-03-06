import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getLatestRecommendations(userId: string) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("project_recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    throw new Error(`Failed to fetch recommendations: ${error.message}`);
  }

  return data ?? [];
}

export async function getRecommendationGenerationCount(userId: string) {
  const supabase = await createServerSupabaseClient();

  const { count, error } = await supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "recommendations_generated");

  if (error) {
    throw new Error(`Failed to fetch recommendation count: ${error.message}`);
  }

  return count ?? 0;
}