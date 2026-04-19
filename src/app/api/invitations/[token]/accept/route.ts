import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  acceptInvitation,
  upsertReviewerProfile,
} from "@/lib/db/mutations/invitations";
import { getInvitationByToken } from "@/lib/db/queries/invitations";
import { captureServerError } from "@/lib/sentry/server";

export async function POST(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return NextResponse.json(
      { error: "Invitation not found.", code: "invitation_not_found" },
      { status: 404 },
    );
  }

  if (invitation.status === "accepted") {
    return NextResponse.json(
      { error: "Invitation already accepted.", code: "invitation_already_accepted" },
      { status: 410 },
    );
  }

  if (invitation.status === "revoked") {
    return NextResponse.json(
      { error: "Invitation is no longer valid.", code: "invitation_revoked" },
      { status: 410 },
    );
  }

  if (invitation.status === "expired" || new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "Invitation is no longer valid.", code: "invitation_expired" },
      { status: 410 },
    );
  }

  if (user.email.toLowerCase() !== invitation.reviewer_email_lower) {
    return NextResponse.json(
      { error: "Signed-in email does not match the invitation.", code: "email_mismatch" },
      { status: 403 },
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: existingProfile, error: profileError } = await admin
    .from("profiles")
    .select("user_role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    captureServerError(profileError, { route: "invitations/accept", token_digest: token.slice(0, 6) });
    return NextResponse.json({ error: "Failed to load profile." }, { status: 500 });
  }

  if (existingProfile && existingProfile.user_role === "student") {
    return NextResponse.json(
      {
        error: "This invitation is for a reviewer account.",
        code: "student_account_cannot_accept",
      },
      { status: 409 },
    );
  }

  if (!existingProfile) {
    try {
      await upsertReviewerProfile(user.id);
    } catch (error) {
      captureServerError(error, {
        route: "invitations/accept",
        stage: "profile_upsert",
      });
      return NextResponse.json({ error: "Failed to create reviewer profile." }, { status: 500 });
    }
  }

  try {
    const result = await acceptInvitation({
      invitationId: invitation.id,
      projectId: invitation.project_id,
      inviterUserId: invitation.inviter_user_id,
      acceptingUserId: user.id,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    captureServerError(error, {
      route: "invitations/accept",
      stage: "accept_mutation",
      invitation_id: invitation.id,
    });
    return NextResponse.json({ error: "Failed to accept invitation." }, { status: 500 });
  }
}
