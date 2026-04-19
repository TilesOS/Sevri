import { z } from "zod";

export const inviteReviewerSchema = z.object({
  reviewer_email: z.string().email().max(254),
  personal_note: z.string().max(500).optional(),
});

export type InviteReviewerInput = z.infer<typeof inviteReviewerSchema>;

export const milestoneReviewSchema = z.object({
  strength: z.string().min(10).max(500),
  tighten: z.string().min(10).max(500),
  next_action: z.string().min(10).max(500),
  ready_to_mark_complete: z.boolean(),
  submission_id: z.string().uuid().optional(),
});

export type MilestoneReviewInput = z.infer<typeof milestoneReviewSchema>;
