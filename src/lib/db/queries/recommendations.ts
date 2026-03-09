import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProjectTrack } from "@/types/domain";

function asProjectTrack(value: unknown): ProjectTrack {
  return value === "research" ? "research" : "software";
}

export async function getLatestProjectTrack(userId: string): Promise<ProjectTrack> {
  const supabase = await createServerSupabaseClient();

  const { data: intake, error: intakeError } = await supabase
    .from("intakes")
    .select("project_track")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (intakeError) {
    throw new Error(`Failed to fetch latest intake track: ${intakeError.message}`);
  }

  if (intake?.project_track) {
    return asProjectTrack(intake.project_track);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("project_track")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`Failed to fetch profile track: ${profileError.message}`);
  }

  return asProjectTrack(profile?.project_track);
}

export async function getLatestRecommendations(userId: string, track: ProjectTrack) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("project_recommendations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(`Failed to fetch recommendations: ${error.message}`);
  }

  return (data ?? [])
    .filter((item) => asProjectTrack(item.project_track) === track)
    .slice(0, 3);
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
