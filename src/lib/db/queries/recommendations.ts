import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProjectTrack } from "@/types/domain";

function asProjectTrack(value: unknown): ProjectTrack {
  return value === "research" ? "research" : "software";
}

function isMissingColumnError(error: unknown, table: string, column: string): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; message?: string };
  const message = candidate.message ?? "";

  return candidate.code === "42703" || message.includes(`column ${table}.${column} does not exist`);
}

function getTrackFromRawAnswers(rawAnswers: unknown): ProjectTrack | null {
  if (!rawAnswers || typeof rawAnswers !== "object") {
    return null;
  }

  const track = (rawAnswers as { project_track?: unknown }).project_track;
  if (track === "software" || track === "research") {
    return track;
  }

  return null;
}

export async function getLatestProjectTrack(userId: string): Promise<ProjectTrack> {
  const supabase = await createServerSupabaseClient();

  const intakeResult = await supabase
    .from("intakes")
    .select("project_track, raw_answers_json")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (intakeResult.error && !isMissingColumnError(intakeResult.error, "intakes", "project_track")) {
    throw new Error(`Failed to fetch latest intake track: ${intakeResult.error.message}`);
  }

  if (!intakeResult.error) {
    if (intakeResult.data?.project_track) {
      return asProjectTrack(intakeResult.data.project_track);
    }

    const fromRawAnswers = getTrackFromRawAnswers(intakeResult.data?.raw_answers_json);
    if (fromRawAnswers) {
      return fromRawAnswers;
    }
  } else {
    const intakeFallbackResult = await supabase
      .from("intakes")
      .select("raw_answers_json")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intakeFallbackResult.error) {
      throw new Error(`Failed to fetch latest intake track fallback: ${intakeFallbackResult.error.message}`);
    }

    const fromRawAnswers = getTrackFromRawAnswers(intakeFallbackResult.data?.raw_answers_json);
    if (fromRawAnswers) {
      return fromRawAnswers;
    }
  }

  const profileResult = await supabase
    .from("profiles")
    .select("project_track")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileResult.error && !isMissingColumnError(profileResult.error, "profiles", "project_track")) {
    throw new Error(`Failed to fetch profile track: ${profileResult.error.message}`);
  }

  if (!profileResult.error && profileResult.data?.project_track) {
    return asProjectTrack(profileResult.data.project_track);
  }

  return "software";
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
