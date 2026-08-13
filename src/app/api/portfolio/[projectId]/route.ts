import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { updatePortfolioEntryForProject } from "@/lib/db/mutations/portfolio";
import { getPortfolioDisplayName } from "@/lib/portfolio/display-name";
import { trackPortfolioReflectionSavedDebounced } from "@/lib/portfolio/events";
import { buildPublicSafetyInput } from "@/lib/portfolio/public-surface";
import { runSafetyChecks } from "@/lib/portfolio/safety";
import { getPortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  student_reflection: z.string().max(6000).nullable().optional(),
  featured_submission_id: z.string().uuid().nullable().optional(),
  featured_evidence_note: z.string().max(1000).nullable().optional(),
  status_override: z.enum(["in_progress", "paused", "completed", "abandoned"]).nullable().optional(),
  featured_artifact_ids: z.array(z.string().uuid()).max(6).optional(),
  artifact_metadata: z.array(z.object({
    id: z.string().uuid(),
    caption: z.string().trim().min(1).max(500),
    alt_text: z.string().trim().min(1).max(500),
  })).max(6).optional(),
});

function isLivePublicPage(view: Awaited<ReturnType<typeof getPortfolioEntryDetailView>>) {
  return Boolean(view?.publicPage?.published_at && !view.publicPage.unpublished_at);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) return response;

  const { projectId } = await context.params;
  const view = await getPortfolioEntryDetailView(projectId, user.id);
  if (!view) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(view);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) return response;

  const { projectId } = await context.params;
  const currentView = await getPortfolioEntryDetailView(projectId, user.id);
  if (!currentView) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = patchSchema.parse(await request.json());
  const artifactIds = new Set(currentView.artifacts.map((artifact) => artifact.id));
  if (payload.artifact_metadata?.some((artifact) => !artifactIds.has(artifact.id))) {
    return NextResponse.json({ error: "Evidence item not found in this project." }, { status: 400 });
  }
  const nextArtifacts = currentView.artifacts.map((artifact) => {
    const update = payload.artifact_metadata?.find((item) => item.id === artifact.id);
    return update ? { ...artifact, caption: update.caption, alt_text: update.alt_text } : artifact;
  });
  const reflectionChanged =
    "student_reflection" in payload &&
    (payload.student_reflection ?? null) !== (currentView.entry.student_reflection ?? null);
  const publicSurfaceChanged =
    reflectionChanged ||
    ("featured_submission_id" in payload && payload.featured_submission_id !== currentView.entry.featured_submission_id) ||
    ("featured_artifact_ids" in payload && payload.featured_artifact_ids !== undefined) ||
    Boolean(payload.artifact_metadata?.some((artifact) => currentView.featuredArtifactIds.includes(artifact.id)));

  if (isLivePublicPage(currentView) && publicSurfaceChanged) {
    const displayName = await getPortfolioDisplayName({
      userId: user.id,
      choice: currentView.publicPage?.display_name_choice ?? "anonymous",
    });
    const nextReflection =
      "student_reflection" in payload
        ? payload.student_reflection ?? null
        : currentView.entry.student_reflection;
    const nextFeaturedSubmissionId =
      "featured_submission_id" in payload
        ? payload.featured_submission_id ?? null
        : currentView.entry.featured_submission_id;
    const candidateView = {
      ...currentView,
      entry: {
        ...currentView.entry,
        student_reflection: nextReflection,
        featured_submission_id: nextFeaturedSubmissionId,
      },
      featuredSubmission: nextFeaturedSubmissionId
        ? currentView.latestSubmissions.find((submission) => submission.id === nextFeaturedSubmissionId) ?? null
        : null,
      featuredArtifactIds: payload.featured_artifact_ids ?? currentView.featuredArtifactIds,
      artifacts: nextArtifacts,
    };
    const safety = runSafetyChecks(buildPublicSafetyInput(candidateView, displayName));
    if (!safety.passed) {
      return NextResponse.json(
        { code: "safety_check_failed", findings: safety.findings },
        { status: 422 },
      );
    }
  }

  if (payload.artifact_metadata?.length) {
    const supabase = await createServerSupabaseClient();
    for (const artifact of payload.artifact_metadata) {
      const { error } = await supabase
        .from("milestone_submission_artifacts")
        .update({ caption: artifact.caption, alt_text: artifact.alt_text })
        .eq("id", artifact.id)
        .eq("owner_user_id", user.id);
      if (error) return NextResponse.json({ error: "Could not save the evidence description." }, { status: 400 });
    }
  }

  const entry = await updatePortfolioEntryForProject({
    projectId,
    userId: user.id,
    studentReflection: payload.student_reflection,
    featuredSubmissionId: payload.featured_submission_id,
    featuredEvidenceNote: payload.featured_evidence_note,
    statusOverride: payload.status_override,
  });

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payload.featured_artifact_ids) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.rpc("set_portfolio_featured_artifacts", {
      p_entry_id: currentView.entry.id,
      p_artifact_ids: payload.featured_artifact_ids,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (reflectionChanged) {
    await trackPortfolioReflectionSavedDebounced({
      userId: user.id,
      portfolioEntryId: currentView.entry.id,
      projectId,
    }).catch((error) => {
      console.error("portfolio reflection event failed", error);
    });
  }

  return NextResponse.json({ entry });
}
