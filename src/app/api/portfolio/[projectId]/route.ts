import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { updatePortfolioEntryForProject } from "@/lib/db/mutations/portfolio";
import { getPortfolioDisplayName } from "@/lib/portfolio/display-name";
import { trackPortfolioReflectionSavedDebounced } from "@/lib/portfolio/events";
import { buildPublicSafetyInput } from "@/lib/portfolio/public-surface";
import { runSafetyChecks } from "@/lib/portfolio/safety";
import { getPortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";

const patchSchema = z.object({
  student_reflection: z.string().max(6000).nullable().optional(),
  featured_submission_id: z.string().uuid().nullable().optional(),
  featured_evidence_note: z.string().max(1000).nullable().optional(),
  status_override: z.enum(["in_progress", "paused", "completed", "abandoned"]).nullable().optional(),
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
  const reflectionChanged =
    "student_reflection" in payload &&
    (payload.student_reflection ?? null) !== (currentView.entry.student_reflection ?? null);
  const publicSurfaceChanged =
    reflectionChanged ||
    ("featured_submission_id" in payload && payload.featured_submission_id !== currentView.entry.featured_submission_id);

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
    };
    const safety = runSafetyChecks(buildPublicSafetyInput(candidateView, displayName));
    if (!safety.passed) {
      return NextResponse.json(
        { code: "safety_check_failed", findings: safety.findings },
        { status: 422 },
      );
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
