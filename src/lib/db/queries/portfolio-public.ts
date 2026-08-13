import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getPortfolioDisplayName } from "@/lib/portfolio/display-name";
import { trimPublicText } from "@/lib/portfolio/public-surface";

interface PublicPageRow {
  id: string;
  user_id: string;
  portfolio_entry_id: string;
  slug: string;
  display_name_choice: "anonymous" | "real";
  published_at: string | null;
  unpublished_at: string | null;
}

interface PublicEntryRow {
  id: string;
  user_id: string;
  project_id: string;
  curated_summary: string | null;
  student_reflection: string | null;
  featured_submission_id: string | null;
}

interface PublicProjectRow {
  id: string;
  user_id: string;
  recommendation_id: string;
  title: string;
}

interface PublicSubmissionRow {
  id: string;
  submission_text: string | null;
}

export interface PublicPortfolioPageView {
  ownerUserId: string;
  slug: string;
  displayName: string;
  projectTitle: string;
  summary: string;
  reflection: string;
  featuredSubmissionExcerpt: string;
  featuredArtifacts: Array<{ id: string; displayName: string; caption: string; altText: string; mimeType: string | null; url: string }>;
}

function cleanSummary(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const clean = trimPublicText(candidate, 1600);
    if (clean.length > 0) {
      return clean;
    }
  }

  return "";
}

async function getFallbackSubmission(input: {
  projectId: string;
  userId: string;
}): Promise<PublicSubmissionRow | null> {
  const supabase = createAdminSupabaseClient();
  const { data: milestones, error: milestoneError } = await supabase
    .from("milestones")
    .select("id")
    .eq("project_id", input.projectId)
    .order("order_index", { ascending: true });

  if (milestoneError) {
    throw new Error(`Failed to load public Portfolio milestones: ${milestoneError.message}`);
  }

  const milestoneIds = ((milestones ?? []) as Array<{ id: string }>).map((milestone) => milestone.id);
  if (milestoneIds.length === 0) {
    return null;
  }

  // Newest submission across the project's milestones. Ordering mirrors
  // src/lib/projects/latest-submission.ts (created_at desc, id desc).
  const { data: submission, error: submissionError } = await supabase
    .from("milestone_submissions")
    .select("id, submission_text")
    .eq("user_id", input.userId)
    .in("milestone_id", milestoneIds)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (submissionError) {
    throw new Error(`Failed to load public Portfolio submission: ${submissionError.message}`);
  }

  return (submission as PublicSubmissionRow | null) ?? null;
}

export async function getPublicPortfolioPageBySlug(slug: string): Promise<PublicPortfolioPageView | null> {
  const supabase = createAdminSupabaseClient();
  const { data: page, error: pageError } = await supabase
    .from("portfolio_public_pages")
    .select("id, user_id, portfolio_entry_id, slug, display_name_choice, published_at, unpublished_at")
    .eq("slug", slug)
    .maybeSingle();

  if (pageError) {
    throw new Error(`Failed to load public Portfolio page: ${pageError.message}`);
  }

  const pageRow = (page as PublicPageRow | null) ?? null;
  if (!pageRow?.published_at || pageRow.unpublished_at) {
    return null;
  }

  const { data: entry, error: entryError } = await supabase
    .from("portfolio_entries")
    .select("id, user_id, project_id, curated_summary, student_reflection, featured_submission_id")
    .eq("id", pageRow.portfolio_entry_id)
    .eq("user_id", pageRow.user_id)
    .maybeSingle();

  if (entryError) {
    throw new Error(`Failed to load public Portfolio entry: ${entryError.message}`);
  }

  const entryRow = (entry as PublicEntryRow | null) ?? null;
  if (!entryRow) {
    return null;
  }

  const [
    { data: project, error: projectError },
    { data: roadmap, error: roadmapError },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, user_id, recommendation_id, title")
      .eq("id", entryRow.project_id)
      .eq("user_id", pageRow.user_id)
      .maybeSingle(),
    supabase
      .from("project_roadmaps")
      .select("overview")
      .eq("project_id", entryRow.project_id)
      .maybeSingle(),
  ]);

  if (projectError) {
    throw new Error(`Failed to load public Portfolio project: ${projectError.message}`);
  }

  if (roadmapError) {
    throw new Error(`Failed to load public Portfolio roadmap: ${roadmapError.message}`);
  }

  const projectRow = (project as PublicProjectRow | null) ?? null;
  if (!projectRow) {
    return null;
  }

  const { data: recommendation, error: recommendationError } = await supabase
    .from("project_recommendations")
    .select("summary")
    .eq("id", projectRow.recommendation_id)
    .eq("user_id", pageRow.user_id)
    .maybeSingle();

  if (recommendationError) {
    throw new Error(`Failed to load public Portfolio recommendation: ${recommendationError.message}`);
  }

  const featuredSubmission = entryRow.featured_submission_id
    ? await supabase
        .from("milestone_submissions")
        .select("id, submission_text")
        .eq("id", entryRow.featured_submission_id)
        .eq("user_id", pageRow.user_id)
        .maybeSingle()
    : { data: null, error: null };

  if (featuredSubmission.error) {
    throw new Error(`Failed to load public Portfolio featured submission: ${featuredSubmission.error.message}`);
  }

  const fallbackSubmission =
    featuredSubmission.data
      ? null
      : await getFallbackSubmission({
          projectId: projectRow.id,
          userId: pageRow.user_id,
        });
  const submission = (featuredSubmission.data as PublicSubmissionRow | null) ?? fallbackSubmission;
  const displayName = await getPortfolioDisplayName({
    userId: pageRow.user_id,
    choice: pageRow.display_name_choice,
    admin: true,
  });
  const { data: featuredRows, error: featuredError } = await supabase
    .from("portfolio_featured_artifacts")
    .select("artifact_id, display_order, public_caption, public_alt_text")
    .eq("portfolio_entry_id", entryRow.id)
    .order("display_order", { ascending: true });
  if (featuredError) throw new Error(`Failed to load public featured evidence: ${featuredError.message}`);
  const featuredIds = (featuredRows ?? []).map((row) => row.artifact_id);
  const { data: artifactRows, error: artifactError } = featuredIds.length
    ? await supabase.from("milestone_submission_artifacts").select("id, upload_path, external_url, display_name, mime_type").in("id", featuredIds)
    : { data: [], error: null };
  if (artifactError) throw new Error(`Failed to load public evidence: ${artifactError.message}`);
  const artifactById = new Map((artifactRows ?? []).map((artifact) => [artifact.id, artifact]));
  const featuredArtifacts = (await Promise.all((featuredRows ?? []).map(async (featured) => {
    const artifact = artifactById.get(featured.artifact_id);
    if (!artifact) return null;
    const url = artifact.external_url ?? (artifact.upload_path ? (await supabase.storage.from("project-evidence").createSignedUrl(artifact.upload_path, 60 * 10)).data?.signedUrl : null);
    if (!url) return null;
    return { id: artifact.id, displayName: artifact.display_name, caption: featured.public_caption, altText: featured.public_alt_text, mimeType: artifact.mime_type, url };
  }))).filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== null);

  return {
    ownerUserId: pageRow.user_id,
    slug: pageRow.slug,
    displayName,
    projectTitle: projectRow.title,
    summary: cleanSummary(
      entryRow.curated_summary,
      typeof roadmap?.overview === "string" ? roadmap.overview : null,
      typeof recommendation?.summary === "string" ? recommendation.summary : null,
    ),
    reflection: trimPublicText(entryRow.student_reflection, 6000),
    featuredSubmissionExcerpt: trimPublicText(submission?.submission_text, 300),
    featuredArtifacts,
  };
}
