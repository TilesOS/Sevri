import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createProjectFromRecommendation(userId: string, recommendationId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: recommendation, error: recommendationError } = await supabase
    .from("project_recommendations")
    .select("id, title")
    .eq("id", recommendationId)
    .eq("user_id", userId)
    .single();

  if (recommendationError) {
    throw new Error(`Failed to load recommendation: ${recommendationError.message}`);
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      recommendation_id: recommendation.id,
      title: recommendation.title,
      status: "active",
    })
    .select("id")
    .single();

  if (projectError) {
    throw new Error(`Failed to create project: ${projectError.message}`);
  }

  return project;
}