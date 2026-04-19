import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { milestoneReviewSchema } from "@/lib/validators/reviewer";
import { createMilestoneReview } from "@/lib/db/mutations/reviewers";
import { listMilestoneReviews } from "@/lib/db/queries/reviewers";
import { captureServerError } from "@/lib/sentry/server";

async function resolveAccess(milestoneId: string, userId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: milestone, error: milestoneError } = await supabase
    .from("milestones")
    .select("id, project_id")
    .eq("id", milestoneId)
    .maybeSingle();

  if (milestoneError) {
    throw new Error(milestoneError.message);
  }

  if (!milestone) {
    return { milestone: null as null, role: "none" as const };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", milestone.project_id)
    .maybeSingle();

  if (project && project.user_id === userId) {
    return { milestone, role: "owner" as const };
  }

  const { data: membership } = await supabase
    .from("project_reviewers")
    .select("id, revoked_at")
    .eq("project_id", milestone.project_id)
    .eq("reviewer_user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (membership) {
    return { milestone, role: "reviewer" as const };
  }

  return { milestone, role: "none" as const };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  const { id: milestoneId } = await context.params;

  try {
    const access = await resolveAccess(milestoneId, user.id);
    if (!access.milestone) {
      return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
    }

    if (access.role === "none") {
      return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
    }

    const reviews = await listMilestoneReviews(milestoneId);
    const scoped =
      access.role === "reviewer"
        ? reviews.filter((review) => review.reviewer_user_id === user.id)
        : reviews;

    return NextResponse.json({ reviews: scoped }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "milestone_reviews/list", milestone_id: milestoneId });
    return NextResponse.json({ error: "Failed to load reviews." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  const { id: milestoneId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  let payload;
  try {
    payload = milestoneReviewSchema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid review", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }

  try {
    const access = await resolveAccess(milestoneId, user.id);
    if (!access.milestone) {
      return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
    }

    if (access.role !== "reviewer") {
      return NextResponse.json(
        { error: "Only assigned reviewers can leave reviews.", code: "not_reviewer" },
        { status: 403 },
      );
    }

    const review = await createMilestoneReview({
      milestoneId,
      reviewerUserId: user.id,
      strength: payload.strength,
      tighten: payload.tighten,
      nextAction: payload.next_action,
      readyToMarkComplete: payload.ready_to_mark_complete,
      submissionId: payload.submission_id,
    });

    return NextResponse.json({ review }, { status: 201 });
  } catch (error) {
    captureServerError(error, { route: "milestone_reviews/create", milestone_id: milestoneId });
    return NextResponse.json({ error: "Failed to save review." }, { status: 500 });
  }
}
