import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface InvitationRecord {
  id: string;
  project_id: string;
  inviter_user_id: string;
  reviewer_email: string;
  reviewer_email_lower: string;
  personal_note: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
}

export async function getInvitationByToken(token: string): Promise<InvitationRecord | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("project_invitations")
    .select(
      "id, project_id, inviter_user_id, reviewer_email, reviewer_email_lower, personal_note, status, created_at, expires_at, accepted_at, accepted_by_user_id",
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up invitation: ${error.message}`);
  }

  return (data ?? null) as InvitationRecord | null;
}

export interface InvitationContextForAcceptPage {
  invitation: InvitationRecord;
  project_title: string;
  inviter_display_name: string;
}

export async function getInvitationContextByToken(
  token: string,
): Promise<InvitationContextForAcceptPage | null> {
  const invitation = await getInvitationByToken(token);
  if (!invitation) {
    return null;
  }

  const supabase = createAdminSupabaseClient();

  const [{ data: project }, { data: inviterProfile }] = await Promise.all([
    supabase.from("projects").select("title").eq("id", invitation.project_id).maybeSingle(),
    supabase
      .from("profiles")
      .select("display_name, full_name")
      .eq("user_id", invitation.inviter_user_id)
      .maybeSingle(),
  ]);

  const inviter_display_name =
    inviterProfile?.display_name ??
    inviterProfile?.full_name ??
    "A student";

  return {
    invitation,
    project_title: project?.title ?? "a Sevri project",
    inviter_display_name,
  };
}
