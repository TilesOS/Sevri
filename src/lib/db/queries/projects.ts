import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getActiveProject(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "paused"])
    .order("selected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch active project: ${error.message}`);
  }

  return data;
}

export async function getProjectWorkspace(projectId: string, userId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (projectError) {
    throw new Error(`Failed to fetch project: ${projectError.message}`);
  }

  const { data: roadmap, error: roadmapError } = await supabase
    .from("project_roadmaps")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (roadmapError) {
    throw new Error(`Failed to fetch roadmap: ${roadmapError.message}`);
  }

  const { data: milestones, error: milestoneError } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  if (milestoneError) {
    throw new Error(`Failed to fetch milestones: ${milestoneError.message}`);
  }

  return { project, roadmap, milestones: milestones ?? [] };
}