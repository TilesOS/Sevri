import type { StoredMilestoneSubmission } from "@/types/domain";

export interface RebuttalSubmissionPayload {
  submissionText: string;
  evidenceSubmissionId: string | null;
}

export function buildRebuttalSubmissionPayload(
  submission: StoredMilestoneSubmission,
  rebuttal: string,
): RebuttalSubmissionPayload {
  const originalNotes = submission.submission_text?.trim() ?? "";
  const evidenceSubmissionId = submission.artifacts?.length
    ? submission.id
    : submission.evidence_submission_id;

  return {
    submissionText: [
      `Student rebuttal to the prior evaluation: ${rebuttal.trim()}`,
      originalNotes ? `Original submission notes:\n${originalNotes}` : null,
      evidenceSubmissionId
        ? "The original artifact bundle is attached for this rebuttal evaluation."
        : null,
    ].filter((part): part is string => Boolean(part)).join("\n\n"),
    evidenceSubmissionId,
  };
}
