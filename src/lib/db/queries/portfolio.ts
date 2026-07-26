import { createServerSupabaseClient } from "@/lib/supabase/server";
import { selectPortfolioEvidence } from "@/lib/projects/latest-submission";

export type PortfolioStatusOverride = "in_progress" | "paused" | "completed" | "abandoned";
export type PortfolioExportFormat = "common_app_activity" | "resume_bullets";

export interface PortfolioEntryRow {
  id: string;
  user_id: string;
  project_id: string;
  status_override: PortfolioStatusOverride | null;
  curated_summary: string | null;
  curation_model: string | null;
  curation_attempted_at: string | null;
  curation_generated_at: string | null;
  curation_metadata_json: Record<string, unknown>;
  student_reflection: string | null;
  featured_submission_id: string | null;
  featured_evidence_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioProjectRow {
  id: string;
  user_id: string;
  recommendation_id: string;
  title: string;
  status: "active" | "paused" | "completed" | string;
  archived_at: string | null;
  selection_operation_id: string;
  project_track: "software" | "research" | string;
  selected_at: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface PortfolioRoadmapRow {
  id: string;
  project_id: string;
  overview: string;
  mvp_scope: string;
  repo_structure: unknown;
  readme_draft: string;
  stretch_goals: string[];
  explanation_guide: unknown;
  raw_model_output_json: unknown;
  project_track: "software" | "research" | string;
  track_payload_json: Record<string, unknown>;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  schedule_timezone: string | null;
  schedule_generation_source: string | null;
  last_schedule_rebalanced_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface PortfolioMilestoneRow {
  id: string;
  project_id: string;
  order_index: number;
  title: string;
  description: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  due_date: string | null;
  schedule_duration_days: number | null;
  is_user_scheduled_override: boolean;
  [key: string]: unknown;
}

export interface PortfolioRecommendationRow {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  project_track: "software" | "research" | string;
  track_payload_json: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PortfolioSubmissionRow {
  id: string;
  milestone_id: string;
  user_id: string;
  submission_kind: "pasted_text" | "file_upload";
  submission_text: string | null;
  submission_filename: string | null;
  storage_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioEvaluationRow {
  id: string;
  submission_id: string;
  user_id: string;
  evaluation_json: unknown;
  status: "pending" | "completed" | "failed";
  failure_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioReviewRow {
  id: string;
  milestone_id: string;
  reviewer_user_id: string;
  submission_id: string | null;
  strength: string;
  tighten: string;
  next_action: string;
  ready_to_mark_complete: boolean;
  created_at: string;
  superseded_at: string | null;
}

export interface PortfolioGithubActivityRow {
  project_id: string;
  cached_commits: unknown;
}

export interface PortfolioExportRow {
  id: string;
  user_id: string;
  portfolio_entry_id: string;
  export_format: PortfolioExportFormat;
  export_json: unknown;
  export_text: string | null;
  generation_metadata_json: Record<string, unknown>;
  generated_at: string;
  created_at: string;
}

export interface PortfolioPublicPageRow {
  id: string;
  user_id: string;
  portfolio_entry_id: string;
  slug: string;
  display_name_choice: "anonymous" | "real";
  safety_snapshot_json: Record<string, unknown>;
  published_at: string | null;
  unpublished_at: string | null;
  public_acknowledged_at: string | null;
  created_at: string;
}

export interface PortfolioListingData {
  projects: PortfolioProjectRow[];
  entries: PortfolioEntryRow[];
  roadmaps: PortfolioRoadmapRow[];
  recommendations: PortfolioRecommendationRow[];
  milestones: PortfolioMilestoneRow[];
}

export interface PortfolioEntryDetailData {
  project: PortfolioProjectRow;
  entry: PortfolioEntryRow;
  roadmap: PortfolioRoadmapRow | null;
  recommendation: PortfolioRecommendationRow | null;
  milestones: PortfolioMilestoneRow[];
  latestSubmissions: PortfolioSubmissionRow[];
  latestEvaluations: PortfolioEvaluationRow[];
  reviews: PortfolioReviewRow[];
  githubActivity: PortfolioGithubActivityRow | null;
  exports: PortfolioExportRow[];
  publicPage: PortfolioPublicPageRow | null;
}

const ENTRY_COLUMNS = [
  "id",
  "user_id",
  "project_id",
  "status_override",
  "curated_summary",
  "curation_model",
  "curation_attempted_at",
  "curation_generated_at",
  "curation_metadata_json",
  "student_reflection",
  "featured_submission_id",
  "featured_evidence_note",
  "created_at",
  "updated_at",
].join(", ");

const ROADMAP_COLUMNS = [
  "id",
  "project_id",
  "overview",
  "mvp_scope",
  "repo_structure",
  "readme_draft",
  "stretch_goals",
  "explanation_guide",
  "raw_model_output_json",
  "project_track",
  "track_payload_json",
  "scheduled_start_date",
  "scheduled_end_date",
  "schedule_timezone",
  "schedule_generation_source",
  "last_schedule_rebalanced_at",
  "created_at",
  "updated_at",
].join(", ");

const MILESTONE_COLUMNS = [
  "id",
  "project_id",
  "order_index",
  "title",
  "description",
  "completed",
  "completed_at",
  "created_at",
  "due_date",
  "schedule_duration_days",
  "is_user_scheduled_override",
].join(", ");

const RECOMMENDATION_COLUMNS = "id, title, summary, rationale, project_track, track_payload_json";
const SUBMISSION_COLUMNS =
  "id, milestone_id, user_id, submission_kind, submission_text, submission_filename, storage_path, created_at, updated_at";
const EVALUATION_COLUMNS =
  "id, submission_id, user_id, evaluation_json, status, failure_message, created_at, updated_at";
const REVIEW_COLUMNS =
  "id, milestone_id, reviewer_user_id, submission_id, strength, tighten, next_action, ready_to_mark_complete, created_at, superseded_at";
const EXPORT_COLUMNS =
  "id, user_id, portfolio_entry_id, export_format, export_json, export_text, generation_metadata_json, generated_at, created_at";
const PUBLIC_PAGE_COLUMNS =
  "id, user_id, portfolio_entry_id, slug, display_name_choice, safety_snapshot_json, published_at, unpublished_at, public_acknowledged_at, created_at";

export async function getPortfolioListingData(userId: string): Promise<PortfolioListingData> {
  const supabase = await createServerSupabaseClient();

  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("selected_at", { ascending: false });

  if (projectError) {
    throw new Error(`Failed to load portfolio projects: ${projectError.message}`);
  }

  const projectRows = (projects ?? []) as PortfolioProjectRow[];
  if (projectRows.length === 0) {
    return { projects: [], entries: [], roadmaps: [], recommendations: [], milestones: [] };
  }

  const projectIds = projectRows.map((project) => project.id);
  const recommendationIds = Array.from(new Set(projectRows.map((project) => project.recommendation_id).filter(Boolean)));

  const [
    { data: entries, error: entryError },
    { data: roadmaps, error: roadmapError },
    { data: milestones, error: milestoneError },
    recommendationResult,
  ] = await Promise.all([
    supabase.from("portfolio_entries").select(ENTRY_COLUMNS).eq("user_id", userId).in("project_id", projectIds),
    supabase.from("project_roadmaps").select(ROADMAP_COLUMNS).in("project_id", projectIds),
    supabase.from("milestones").select(MILESTONE_COLUMNS).in("project_id", projectIds).order("order_index", { ascending: true }),
    recommendationIds.length > 0
      ? supabase.from("project_recommendations").select(RECOMMENDATION_COLUMNS).eq("user_id", userId).in("id", recommendationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (entryError) {
    throw new Error(`Failed to load portfolio entries: ${entryError.message}`);
  }

  if (roadmapError) {
    throw new Error(`Failed to load portfolio roadmaps: ${roadmapError.message}`);
  }

  if (milestoneError) {
    throw new Error(`Failed to load portfolio milestones: ${milestoneError.message}`);
  }

  if (recommendationResult.error) {
    throw new Error(`Failed to load portfolio recommendations: ${recommendationResult.error.message}`);
  }

  return {
    projects: projectRows,
    entries: (entries ?? []) as unknown as PortfolioEntryRow[],
    roadmaps: (roadmaps ?? []) as unknown as PortfolioRoadmapRow[],
    recommendations: (recommendationResult.data ?? []) as PortfolioRecommendationRow[],
    milestones: (milestones ?? []) as unknown as PortfolioMilestoneRow[],
  };
}

export async function getPortfolioEntryDetailData(
  projectId: string,
  userId: string,
): Promise<PortfolioEntryDetailData | null> {
  const supabase = await createServerSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (projectError) {
    throw new Error(`Failed to load portfolio project: ${projectError.message}`);
  }

  if (!project) {
    return null;
  }

  const projectRow = project as PortfolioProjectRow;
  const [
    { data: entry, error: entryError },
    { data: roadmap, error: roadmapError },
    { data: milestones, error: milestoneError },
    { data: recommendation, error: recommendationError },
  ] = await Promise.all([
    supabase
      .from("portfolio_entries")
      .select(ENTRY_COLUMNS)
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("project_roadmaps").select(ROADMAP_COLUMNS).eq("project_id", projectId).maybeSingle(),
    supabase.from("milestones").select(MILESTONE_COLUMNS).eq("project_id", projectId).order("order_index", { ascending: true }),
    supabase
      .from("project_recommendations")
      .select(RECOMMENDATION_COLUMNS)
      .eq("id", projectRow.recommendation_id)
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (entryError) {
    throw new Error(`Failed to load portfolio entry: ${entryError.message}`);
  }

  if (!entry) {
    return null;
  }

  if (roadmapError) {
    throw new Error(`Failed to load portfolio roadmap: ${roadmapError.message}`);
  }

  if (milestoneError) {
    throw new Error(`Failed to load portfolio milestones: ${milestoneError.message}`);
  }

  if (recommendationError) {
    throw new Error(`Failed to load portfolio recommendation: ${recommendationError.message}`);
  }

  const entryRow = entry as unknown as PortfolioEntryRow;
  const milestoneRows = (milestones ?? []) as unknown as PortfolioMilestoneRow[];
  const milestoneIds = milestoneRows.map((milestone) => milestone.id);

  const [
    { data: submissions, error: submissionError },
    { data: reviews, error: reviewError },
    { data: githubActivity, error: githubError },
  ] = await Promise.all([
    milestoneIds.length > 0
      ? supabase
          .from("milestone_submissions")
          .select(SUBMISSION_COLUMNS)
          .eq("user_id", userId)
          .in("milestone_id", milestoneIds)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    milestoneIds.length > 0
      ? supabase
          .from("milestone_reviews")
          .select(REVIEW_COLUMNS)
          .in("milestone_id", milestoneIds)
          .is("superseded_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("project_github_links").select("project_id, cached_commits").eq("project_id", projectId).maybeSingle(),
  ]);

  if (submissionError) {
    throw new Error(`Failed to load portfolio submissions: ${submissionError.message}`);
  }

  if (reviewError) {
    throw new Error(`Failed to load portfolio reviews: ${reviewError.message}`);
  }

  if (githubError) {
    throw new Error(`Failed to load portfolio GitHub cache: ${githubError.message}`);
  }

  // Every revision for the project comes back; narrow it to the current
  // submission per milestone (plus any pinned older revision) here.
  const submissionRows = selectPortfolioEvidence(
    (submissions ?? []) as unknown as PortfolioSubmissionRow[],
    entryRow.featured_submission_id,
  );
  const submissionIds = submissionRows.map((submission) => submission.id);

  const [
    { data: evaluations, error: evaluationError },
    { data: exports, error: exportError },
    { data: publicPage, error: publicPageError },
  ] = await Promise.all([
    submissionIds.length > 0
      ? supabase
          .from("milestone_submission_evaluations")
          .select(EVALUATION_COLUMNS)
          .eq("user_id", userId)
          .in("submission_id", submissionIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("portfolio_exports").select(EXPORT_COLUMNS).eq("portfolio_entry_id", entryRow.id).eq("user_id", userId),
    supabase.from("portfolio_public_pages").select(PUBLIC_PAGE_COLUMNS).eq("portfolio_entry_id", entryRow.id).eq("user_id", userId).maybeSingle(),
  ]);

  if (evaluationError) {
    throw new Error(`Failed to load portfolio evaluations: ${evaluationError.message}`);
  }

  if (exportError) {
    throw new Error(`Failed to load portfolio exports: ${exportError.message}`);
  }

  if (publicPageError) {
    throw new Error(`Failed to load portfolio public page: ${publicPageError.message}`);
  }

  return {
    project: projectRow,
    entry: entryRow,
    roadmap: (roadmap as PortfolioRoadmapRow | null) ?? null,
    recommendation: (recommendation as PortfolioRecommendationRow | null) ?? null,
    milestones: milestoneRows,
    latestSubmissions: submissionRows,
    latestEvaluations: (evaluations ?? []) as unknown as PortfolioEvaluationRow[],
    reviews: (reviews ?? []) as PortfolioReviewRow[],
    githubActivity: (githubActivity as PortfolioGithubActivityRow | null) ?? null,
    exports: (exports ?? []) as unknown as PortfolioExportRow[],
    publicPage: (publicPage as unknown as PortfolioPublicPageRow | null) ?? null,
  };
}
