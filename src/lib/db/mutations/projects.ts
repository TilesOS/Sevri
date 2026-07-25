import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Statuses that still count as "you already started this idea". */
const LIVE_PROJECT_STATUSES = ["active", "paused", "completed"] as const;

export interface ExistingProjectForRecommendation {
  id: string;
  title: string;
  status: string;
  project_track: string;
}

/**
 * The project a recommendation has already produced, if any. Archived copies do
 * not count — archiving is how a student says "hide this one", so re-selecting
 * afterwards should just work.
 */
export async function findProjectForRecommendation(
  userId: string,
  recommendationId: string,
): Promise<ExistingProjectForRecommendation | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("projects")
    .select("id, title, status, project_track")
    .eq("user_id", userId)
    .eq("recommendation_id", recommendationId)
    .in("status", LIVE_PROJECT_STATUSES)
    .order("selected_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check for an existing project: ${error.message}`);
  }

  return data ?? null;
}

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

/**
 * Archiving hides a project from the dashboard and calendar without deleting
 * anything: the roadmap, steps, submissions, and Portfolio entry all stay, and
 * restoring puts it straight back. This is the recovery path for the duplicate
 * projects an unguarded double-click used to create.
 */
export async function setProjectArchived(userId: string, projectId: string, archived: boolean) {
  const supabase = await createServerSupabaseClient();

  const { data: project, error: readError } = await supabase
    .from("projects")
    .select("id, status")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (readError || !project) {
    throw new Error("Project not found");
  }

  if (archived && project.status === "archived") {
    return { id: project.id, status: project.status };
  }

  // Restoring returns the project to active rather than guessing at the status
  // it held before; completed projects keep their completed status.
  const nextStatus = archived ? "archived" : project.status === "archived" ? "active" : project.status;

  const { data: updated, error: updateError } = await supabase
    .from("projects")
    .update({ status: nextStatus })
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("id, status")
    .single();

  if (updateError || !updated) {
    throw new Error(`Failed to update project status: ${updateError?.message ?? "unknown error"}`);
  }

  return updated;
}
