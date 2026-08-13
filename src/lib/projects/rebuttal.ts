import type { StoredMilestoneSubmission } from "@/types/domain";

export const MAX_SUBMISSION_CHARS = 20_000;
export const MAX_REBUTTAL_CHARS = 500;

const REBUTTAL_PREFIX = "Student rebuttal to the prior evaluation: ";
const ORIGINAL_NOTES_PREFIX = "Original submission notes:\n";
const EVIDENCE_NOTICE = "The original artifact bundle is attached for this rebuttal evaluation.";
const SECTION_SEPARATOR = "\n\n";

export const MAX_REBUTTAL_SUBMISSION_CHARS =
  REBUTTAL_PREFIX.length
  + MAX_REBUTTAL_CHARS
  + SECTION_SEPARATOR.length
  + ORIGINAL_NOTES_PREFIX.length
  + MAX_SUBMISSION_CHARS
  + SECTION_SEPARATOR.length
  + EVIDENCE_NOTICE.length;

export interface RebuttalSubmissionPayload {
  submissionText: string;
  evidenceSubmissionId: string | null;
}

export function buildRebuttalSubmissionPayload(
  submission: StoredMilestoneSubmission,
  rebuttal: string,
): RebuttalSubmissionPayload {
  const originalNotes = submission.evidence_submission_id
    ? ""
    : submission.submission_text?.trim() ?? "";
  const evidenceSubmissionId = submission.artifacts?.length
    ? submission.id
    : submission.evidence_submission_id;

  return {
    submissionText: [
      `${REBUTTAL_PREFIX}${rebuttal.trim()}`,
      originalNotes ? `${ORIGINAL_NOTES_PREFIX}${originalNotes}` : null,
      evidenceSubmissionId ? EVIDENCE_NOTICE : null,
    ].filter((part): part is string => Boolean(part)).join(SECTION_SEPARATOR),
    evidenceSubmissionId,
  };
}
