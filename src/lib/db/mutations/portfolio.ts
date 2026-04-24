import { createServerSupabaseClient } from "@/lib/supabase/server";

type PortfolioEntryInsert = {
  user_id: string;
  project_id: string;
};

export async function ensurePortfolioEntriesForUserProjects(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId);

  if (projectError) {
    throw new Error(`Failed to load projects for portfolio entries: ${projectError.message}`);
  }

  const rows: PortfolioEntryInsert[] = (projects ?? []).map((project) => ({
    user_id: userId,
    project_id: project.id,
  }));

  if (rows.length === 0) {
    return { projectIds: [] as string[] };
  }

  const { error: upsertError } = await supabase
    .from("portfolio_entries")
    .upsert(rows, { onConflict: "project_id", ignoreDuplicates: true });

  if (upsertError) {
    throw new Error(`Failed to ensure portfolio entries: ${upsertError.message}`);
  }

  return { projectIds: rows.map((row) => row.project_id) };
}

export async function ensurePortfolioEntryForProject(projectId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError) {
    throw new Error(`Failed to load project for portfolio entry: ${projectError.message}`);
  }

  if (!project) {
    return null;
  }

  const { error: upsertError } = await supabase
    .from("portfolio_entries")
    .upsert(
      {
        user_id: userId,
        project_id: projectId,
      },
      { onConflict: "project_id", ignoreDuplicates: true },
    );

  if (upsertError) {
    throw new Error(`Failed to ensure portfolio entry: ${upsertError.message}`);
  }

  const { data: entry, error: entryError } = await supabase
    .from("portfolio_entries")
    .select("*")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .single();

  if (entryError) {
    throw new Error(`Failed to load portfolio entry: ${entryError.message}`);
  }

  return entry;
}
