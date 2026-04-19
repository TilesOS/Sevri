import crypto from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CreatedInvitation {
  id: string;
  project_id: string;
  reviewer_email: string;
  status: "pending";
  created_at: string;
  expires_at: string;
  token: string;
}

interface CreateInvitationInput {
  projectId: string;
  inviterUserId: string;
  reviewerEmail: string;
  personalNote?: string;
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export async function createInvitation(input: CreateInvitationInput): Promise<CreatedInvitation> {
  const supabase = await createServerSupabaseClient();
  const token = generateToken();
  const reviewerEmailLower = input.reviewerEmail.trim().toLowerCase();

  const { data, error } = await supabase
    .from("project_invitations")
    .insert({
      project_id: input.projectId,
      inviter_user_id: input.inviterUserId,
      reviewer_email: input.reviewerEmail.trim(),
      reviewer_email_lower: reviewerEmailLower,
      token,
      personal_note: input.personalNote?.trim() || null,
    })
    .select("id, project_id, reviewer_email, status, created_at, expires_at")
    .single();

  if (error) {
    throw new Error(`Failed to create invitation: ${error.message}`);
  }

  return { ...(data as Omit<CreatedInvitation, "token">), token };
}

export async function deleteInvitationById(invitationId: string): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("project_invitations").delete().eq("id", invitationId);
  if (error) {
    throw new Error(`Failed to delete invitation: ${error.message}`);
  }
}

export interface RevokeInvitationResult {
  id: string;
  status: "revoked";
}

export async function revokeInvitation(invitationId: string): Promise<RevokeInvitationResult> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .select("id, status")
    .single();

  if (error) {
    throw new Error(`Failed to revoke invitation: ${error.message}`);
  }

  return data as RevokeInvitationResult;
}

export interface AcceptInvitationResult {
  project_id: string;
  reviewer_id: string;
}

interface AcceptInvitationInput {
  invitationId: string;
  projectId: string;
  inviterUserId: string;
  acceptingUserId: string;
}

export async function acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult> {
  const supabase = createAdminSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("project_reviewers")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("reviewer_user_id", input.acceptingUserId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to look up reviewer: ${existingError.message}`);
  }

  let reviewerId: string;

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("project_reviewers")
      .update({
        revoked_at: null,
        joined_at: new Date().toISOString(),
        invited_by_user_id: input.inviterUserId,
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (updateError) {
      throw new Error(`Failed to reactivate reviewer: ${updateError.message}`);
    }

    reviewerId = updated.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("project_reviewers")
      .insert({
        project_id: input.projectId,
        reviewer_user_id: input.acceptingUserId,
        invited_by_user_id: input.inviterUserId,
      })
      .select("id")
      .single();

    if (insertError) {
      throw new Error(`Failed to create reviewer: ${insertError.message}`);
    }

    reviewerId = inserted.id;
  }

  const { error: invitationError } = await supabase
    .from("project_invitations")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: input.acceptingUserId,
    })
    .eq("id", input.invitationId);

  if (invitationError) {
    throw new Error(`Failed to mark invitation accepted: ${invitationError.message}`);
  }

  return { project_id: input.projectId, reviewer_id: reviewerId };
}

export async function upsertReviewerProfile(userId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("profiles")
    .select("user_id, user_role")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load profile: ${existingError.message}`);
  }

  if (existing) {
    return;
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    user_id: userId,
    full_name: null,
    student_stage: null,
    target_outcome: null,
    project_track: "software",
    user_role: "reviewer",
  });

  if (insertError) {
    throw new Error(`Failed to create reviewer profile: ${insertError.message}`);
  }
}
