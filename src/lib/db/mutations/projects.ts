import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function createProjectFromRecommendation(userId: string, recommendationId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: recommendation, error: recommendationError } = await supabase
    .from("project_recommendations")
    .select("id, title, project_track")
    .eq("id", recommendationId)
    .eq("user_id", userId)
    .single();

  if (recommendationError) {
    throw new Error(`Failed to load recommendation: ${recommendationError.message}`);
  }

  const projectTrack = recommendation.project_track === "research" ? "research" : "software";

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      recommendation_id: recommendation.id,
      project_track: projectTrack,
      title: recommendation.title,
      status: "active",
    })
    .select("id, project_track")
    .single();

  if (projectError) {
    throw new Error(`Failed to create project: ${projectError.message}`);
  }

  return project;
}
