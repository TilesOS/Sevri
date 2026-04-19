import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revokeReviewer } from "@/lib/db/mutations/reviewers";
import { captureServerError } from "@/lib/sentry/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; reviewerId: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const { id: projectId, reviewerId } = await context.params;
  const supabase = await createServerSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    captureServerError(projectError, { route: "reviewers/revoke", project_id: projectId });
    return NextResponse.json({ error: "Failed to load project." }, { status: 500 });
  }

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { data: reviewerRow, error: reviewerError } = await supabase
    .from("project_reviewers")
    .select("id, project_id, revoked_at")
    .eq("id", reviewerId)
    .maybeSingle();

  if (reviewerError) {
    captureServerError(reviewerError, { route: "reviewers/revoke", reviewer_id: reviewerId });
    return NextResponse.json({ error: "Failed to load reviewer." }, { status: 500 });
  }

  if (!reviewerRow || reviewerRow.project_id !== projectId) {
    return NextResponse.json({ error: "Reviewer not found." }, { status: 404 });
  }

  if (reviewerRow.revoked_at !== null) {
    return NextResponse.json(
      { error: "Reviewer already revoked.", code: "reviewer_already_revoked" },
      { status: 409 },
    );
  }

  try {
    const result = await revokeReviewer(reviewerId);
    return NextResponse.json({ reviewer_id: result.id, revoked_at: result.revoked_at }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "reviewers/revoke", reviewer_id: reviewerId });
    return NextResponse.json({ error: "Failed to revoke reviewer." }, { status: 500 });
  }
}
