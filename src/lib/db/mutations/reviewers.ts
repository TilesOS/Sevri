import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CreatedMilestoneReview {
  id: string;
  milestone_id: string;
  reviewer_user_id: string;
  submission_id: string | null;
  strength: string;
  tighten: string;
  next_action: string;
  ready_to_mark_complete: boolean;
  created_at: string;
  superseded_at: string | null;
}

interface CreateMilestoneReviewInput {
  milestoneId: string;
  reviewerUserId: string;
  strength: string;
  tighten: string;
  nextAction: string;
  readyToMarkComplete: boolean;
  submissionId?: string;
}

export async function createMilestoneReview(
  input: CreateMilestoneReviewInput,
): Promise<CreatedMilestoneReview> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("milestone_reviews")
    .insert({
      milestone_id: input.milestoneId,
      reviewer_user_id: input.reviewerUserId,
      submission_id: input.submissionId ?? null,
      strength: input.strength,
      tighten: input.tighten,
      next_action: input.nextAction,
      ready_to_mark_complete: input.readyToMarkComplete,
    })
    .select(
      "id, milestone_id, reviewer_user_id, submission_id, strength, tighten, next_action, ready_to_mark_complete, created_at, superseded_at",
    )
    .single();

  if (error) {
    throw new Error(`Failed to create milestone review: ${error.message}`);
  }

  return data as CreatedMilestoneReview;
}

export interface RevokeReviewerResult {
  id: string;
  revoked_at: string;
}

export async function revokeReviewer(reviewerRowId: string): Promise<RevokeReviewerResult> {
  const supabase = await createServerSupabaseClient();
  const revokedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("project_reviewers")
    .update({ revoked_at: revokedAt })
    .eq("id", reviewerRowId)
    .select("id, revoked_at")
    .single();

  if (error) {
    throw new Error(`Failed to revoke reviewer: ${error.message}`);
  }

  return data as RevokeReviewerResult;
}
