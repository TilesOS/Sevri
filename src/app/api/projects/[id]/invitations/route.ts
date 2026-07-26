import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { inviteReviewerSchema } from "@/lib/validators/reviewer";
import { createInvitation, deleteInvitationById } from "@/lib/db/mutations/invitations";
import { reviewerInvitationTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email/resend";
import {
  consumeRateLimitReservation,
  enforceRateLimit,
  releaseRateLimitReservation,
} from "@/lib/usage/rate-limit";
import { clientEnv } from "@/lib/env";
import { captureServerError } from "@/lib/sentry/server";
import { assertFeatureAccess, createUpgradeRequiredResponse } from "@/lib/usage/feature-access";
import { reviewerLimit } from "@/lib/usage/limits";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const { id: projectId } = await context.params;

  let payload: { reviewer_email: string; personal_note?: string };
  try {
    const body = await request.json();
    payload = inviteReviewerSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request", details: error instanceof Error ? error.message : "Unknown" },
      { status: 400 },
    );
  }

  const reviewerEmailLower = payload.reviewer_email.trim().toLowerCase();

  if (user.email && user.email.toLowerCase() === reviewerEmailLower) {
    return NextResponse.json(
      { error: "You cannot invite yourself.", code: "cannot_invite_self" },
      { status: 400 },
    );
  }

  const access = await assertFeatureAccess({ userId: user.id, feature: "invite_reviewer" });
  if (!access.allowed) {
    return createUpgradeRequiredResponse(access.error);
  }

  const supabase = await createServerSupabaseClient();
  const nowIso = new Date().toISOString();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: "Failed to load project." }, { status: 500 });
  }

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { error: expireError } = await supabase
    .from("project_invitations")
    .update({ status: "expired" })
    .eq("project_id", projectId)
    .eq("status", "pending")
    .lte("expires_at", nowIso);

  if (expireError) {
    return NextResponse.json({ error: "Failed to refresh invitation state." }, { status: 500 });
  }

  const [{ count: activeReviewerCount, error: reviewerCountError }, { count: pendingInviteCount, error: pendingCountError }] =
    await Promise.all([
      supabase
        .from("project_reviewers")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .is("revoked_at", null),
      supabase
        .from("project_invitations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "pending")
        .gt("expires_at", nowIso),
    ]);

  if (reviewerCountError || pendingCountError) {
    return NextResponse.json({ error: "Failed to check invitation limit." }, { status: 500 });
  }

  const currentCount = (activeReviewerCount ?? 0) + (pendingInviteCount ?? 0);
  const limit = reviewerLimit(access.plan);

  if (currentCount >= limit) {
    return NextResponse.json(
      {
        error: "This project already has the maximum number of reviewers.",
        code: "reviewer_limit_reached",
      },
      { status: 400 },
    );
  }

  const { data: existingPending, error: existingPendingError } = await supabase
    .from("project_invitations")
    .select("id")
    .eq("project_id", projectId)
    .eq("reviewer_email_lower", reviewerEmailLower)
    .eq("status", "pending")
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (existingPendingError) {
    return NextResponse.json({ error: "Failed to check for existing invitation." }, { status: 500 });
  }

  if (existingPending) {
    return NextResponse.json(
      { error: "An invitation to this email is already pending.", code: "invitation_already_pending" },
      { status: 409 },
    );
  }

  const reservationIds: string[] = [];
  try {
    const perProjectLimit = await enforceRateLimit({
      userId: user.id,
      endpoint: `invitations:project:${projectId}`,
      maxRequests: 5,
      windowMinutes: 1440,
    });
    if (!perProjectLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many invitations for this project today. Try again tomorrow.",
          code: "rate_limited",
          reset_at: perProjectLimit.resetAt,
        },
        {
          status: 429,
          headers: { "Retry-After": String(perProjectLimit.retryAfterSeconds) },
        },
      );
    }
    reservationIds.push(perProjectLimit.reservationId);

    const perInviterLimit = await enforceRateLimit({
      userId: user.id,
      endpoint: "invitations:inviter",
      maxRequests: 20,
      windowMinutes: 1440,
    });
    if (!perInviterLimit.allowed) {
      return NextResponse.json(
        {
          error: "Too many invitations today. Try again tomorrow.",
          code: "rate_limited",
          reset_at: perInviterLimit.resetAt,
        },
        {
          status: 429,
          headers: { "Retry-After": String(perInviterLimit.retryAfterSeconds) },
        },
      );
    }
    reservationIds.push(perInviterLimit.reservationId);

    let invitation: Awaited<ReturnType<typeof createInvitation>>;
    try {
      invitation = await createInvitation({
        projectId,
        inviterUserId: user.id,
        reviewerEmail: payload.reviewer_email,
        personalNote: payload.personal_note,
      });
    } catch (error) {
      captureServerError(error, { route: "invitations/create", project_id: projectId });
      return NextResponse.json({ error: "Failed to create invitation." }, { status: 500 });
    }

    const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
    const acceptUrl = `${siteUrl}/accept-invitation/${invitation.token}`;

    const { data: inviterProfile } = await supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const inviterName =
      inviterProfile?.display_name ?? inviterProfile?.full_name ?? "A student";

    const template = reviewerInvitationTemplate({
      inviterName,
      projectTitle: project.title,
      acceptUrl,
      personalNote: payload.personal_note,
    });

    try {
      await sendEmail(payload.reviewer_email.trim(), template.subject, template.html);
    } catch (error) {
      captureServerError(error, {
        route: "invitations/create",
        stage: "email_send",
        invitation_id: invitation.id,
      });
      await deleteInvitationById(invitation.id).catch((deleteError) => {
        captureServerError(deleteError, {
          route: "invitations/create",
          stage: "email_send_rollback",
          invitation_id: invitation.id,
        });
      });
      return NextResponse.json(
        { error: "Failed to send invitation email.", code: "email_send_failed" },
        { status: 502 },
      );
    }

    const completedReservationIds = reservationIds.splice(0);
    await Promise.all(
      completedReservationIds.map((reservationId) =>
        consumeRateLimitReservation(reservationId, invitation.id),
      ),
    );

    return NextResponse.json(
      {
        invitation: {
          id: invitation.id,
          project_id: invitation.project_id,
          reviewer_email: invitation.reviewer_email,
          status: invitation.status,
          created_at: invitation.created_at,
          expires_at: invitation.expires_at,
        },
      },
      { status: 201 },
    );
  } finally {
    await Promise.all(
      reservationIds.map((reservationId) =>
        releaseRateLimitReservation(reservationId).catch((releaseError) => {
          captureServerError(releaseError, {
            route: "invitations/create",
            project_id: projectId,
            stage: "release-rate-limit",
          });
        }),
      ),
    );
  }
}
