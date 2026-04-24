import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PortfolioExportFormat, PortfolioStatusOverride } from "@/lib/db/queries/portfolio";

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

export async function updatePortfolioEntryForProject(input: {
  projectId: string;
  userId: string;
  studentReflection?: string | null;
  featuredSubmissionId?: string | null;
  featuredEvidenceNote?: string | null;
  statusOverride?: PortfolioStatusOverride | null;
}) {
  const supabase = await createServerSupabaseClient();

  const entry = await ensurePortfolioEntryForProject(input.projectId, input.userId);
  if (!entry) {
    return null;
  }

  if (input.featuredSubmissionId) {
    const { data: submission, error: submissionError } = await supabase
      .from("milestone_submissions")
      .select("id, milestone_id")
      .eq("id", input.featuredSubmissionId)
      .eq("user_id", input.userId)
      .maybeSingle();

    if (submissionError) {
      throw new Error(`Failed to verify featured submission: ${submissionError.message}`);
    }

    if (!submission) {
      throw new Error("Featured submission not found.");
    }

    const { data: milestone, error: milestoneError } = await supabase
      .from("milestones")
      .select("id")
      .eq("id", submission.milestone_id)
      .eq("project_id", input.projectId)
      .maybeSingle();

    if (milestoneError) {
      throw new Error(`Failed to verify featured submission project: ${milestoneError.message}`);
    }

    if (!milestone) {
      throw new Error("Featured submission does not belong to this project.");
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.studentReflection !== undefined) patch.student_reflection = input.studentReflection;
  if (input.featuredSubmissionId !== undefined) patch.featured_submission_id = input.featuredSubmissionId;
  if (input.featuredEvidenceNote !== undefined) patch.featured_evidence_note = input.featuredEvidenceNote;
  if (input.statusOverride !== undefined) patch.status_override = input.statusOverride;

  const { data, error } = await supabase
    .from("portfolio_entries")
    .update(patch)
    .eq("id", entry.id)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update portfolio entry: ${error.message}`);
  }

  return data;
}

export async function markPortfolioCurationAttempted(input: {
  entryId: string;
  userId: string;
  metadata: Record<string, unknown>;
}) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("portfolio_entries")
    .update({
      curation_attempted_at: new Date().toISOString(),
      curation_metadata_json: input.metadata,
    })
    .eq("id", input.entryId)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`Failed to mark portfolio curation attempt: ${error.message}`);
  }
}

export async function savePortfolioCuration(input: {
  entryId: string;
  userId: string;
  curatedSummary: string;
  model: string | null;
  metadata: Record<string, unknown>;
}) {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("portfolio_entries")
    .update({
      curated_summary: input.curatedSummary,
      curation_model: input.model,
      curation_attempted_at: now,
      curation_generated_at: now,
      curation_metadata_json: input.metadata,
    })
    .eq("id", input.entryId)
    .eq("user_id", input.userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save portfolio curation: ${error.message}`);
  }

  return data;
}

export async function upsertPortfolioExport(input: {
  entryId: string;
  userId: string;
  format: PortfolioExportFormat;
  exportJson: unknown;
  exportText: string | null;
  metadata: Record<string, unknown>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("portfolio_exports")
    .upsert(
      {
        user_id: input.userId,
        portfolio_entry_id: input.entryId,
        export_format: input.format,
        export_json: input.exportJson,
        export_text: input.exportText,
        generation_metadata_json: input.metadata,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "portfolio_entry_id,export_format" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to save portfolio export: ${error.message}`);
  }

  return data;
}

export async function findPortfolioPublicPageSlug(slug: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("portfolio_public_pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check portfolio slug: ${error.message}`);
  }

  return data ? String(data.id) : null;
}

export async function publishPortfolioPage(input: {
  entryId: string;
  userId: string;
  slug: string;
  displayNameChoice: "anonymous" | "real";
  safetySnapshot: Record<string, unknown>;
}) {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { data: existing, error: existingError } = await supabase
    .from("portfolio_public_pages")
    .select("id, slug")
    .eq("portfolio_entry_id", input.entryId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load portfolio public page: ${existingError.message}`);
  }

  const payload = {
    user_id: input.userId,
    portfolio_entry_id: input.entryId,
    slug: existing?.slug ?? input.slug,
    display_name_choice: input.displayNameChoice,
    safety_snapshot_json: input.safetySnapshot,
    published_at: now,
    unpublished_at: null,
    public_acknowledged_at: now,
  };

  const query = existing
    ? supabase.from("portfolio_public_pages").update(payload).eq("id", existing.id)
    : supabase.from("portfolio_public_pages").insert(payload);

  const { data, error } = await query.select("*").single();

  if (error) {
    throw new Error(`Failed to publish portfolio page: ${error.message}`);
  }

  return data;
}

export async function unpublishPortfolioPage(input: {
  entryId: string;
  userId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("portfolio_public_pages")
    .update({
      published_at: null,
      unpublished_at: new Date().toISOString(),
    })
    .eq("portfolio_entry_id", input.entryId)
    .eq("user_id", input.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to unpublish portfolio page: ${error.message}`);
  }

  return data;
}
