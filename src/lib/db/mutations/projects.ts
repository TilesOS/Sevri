import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ProjectSelectionResult {
  id: string;
  title: string;
  project_kind_label: string;
  repository_relevance: string;
  outcome: "created" | "replayed" | "duplicate";
}

/**
 * Select a recommendation through the database transaction that owns the
 * duplicate decision, idempotency lookup, ownership check, and insert.
 */
export async function selectProjectFromRecommendation(
  recommendationId: string,
  operationId: string,
  allowDuplicate: boolean,
): Promise<ProjectSelectionResult> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .rpc("select_project_from_recommendation", {
      p_recommendation_id: recommendationId,
      p_operation_id: operationId,
      p_allow_duplicate: allowDuplicate,
    })
    .single();

  if (error || !data) {
    throw new Error(`Failed to select recommendation: ${error?.message ?? "unknown error"}`);
  }

  const row = data as {
    project_id: string;
    project_title: string;
    project_kind_label: string;
    repository_relevance: string;
    selection_outcome: ProjectSelectionResult["outcome"];
  };

  return {
    id: row.project_id,
    title: row.project_title,
    project_kind_label: row.project_kind_label,
    repository_relevance: row.repository_relevance,
    outcome: row.selection_outcome,
  };
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
    .select("id, status, archived_at")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (readError || !project) {
    throw new Error("Project not found");
  }

  if (archived === Boolean(project.archived_at)) {
    return project;
  }

  const { data: updated, error: updateError } = await supabase
    .from("projects")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", projectId)
    .eq("user_id", userId)
    .select("id, status, archived_at")
    .single();

  if (updateError || !updated) {
    throw new Error(`Failed to update project status: ${updateError?.message ?? "unknown error"}`);
  }

  return updated;
}
