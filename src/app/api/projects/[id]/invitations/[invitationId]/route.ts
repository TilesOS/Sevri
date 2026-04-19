import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revokeInvitation } from "@/lib/db/mutations/invitations";
import { captureServerError } from "@/lib/sentry/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const { id: projectId, invitationId } = await context.params;
  const supabase = await createServerSupabaseClient();

  const { data: invitation, error } = await supabase
    .from("project_invitations")
    .select("id, project_id, inviter_user_id, status")
    .eq("id", invitationId)
    .maybeSingle();

  if (error) {
    captureServerError(error, { route: "invitations/revoke", invitation_id: invitationId });
    return NextResponse.json({ error: "Failed to load invitation." }, { status: 500 });
  }

  if (!invitation || invitation.project_id !== projectId || invitation.inviter_user_id !== user.id) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }

  if (invitation.status !== "pending") {
    return NextResponse.json(
      { error: "Invitation is not pending.", code: "invitation_not_pending" },
      { status: 409 },
    );
  }

  try {
    const result = await revokeInvitation(invitationId);
    return NextResponse.json({ invitation_id: result.id, status: result.status }, { status: 200 });
  } catch (revokeError) {
    captureServerError(revokeError, { route: "invitations/revoke", invitation_id: invitationId });
    return NextResponse.json({ error: "Failed to revoke invitation." }, { status: 500 });
  }
}
