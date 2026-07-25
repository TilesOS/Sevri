// How to find the current submission for a milestone.
//
// Migration 0006 dropped `milestone_submissions.is_latest` along with the trigger
// that maintained it, so "latest" is derived at read time: newest `created_at`
// first, with `id` as a stable tiebreaker for rows written in the same
// transaction. This matches idx_milestone_submissions_milestone_created
// (milestone_id, created_at desc, id desc). Every read path that needs the
// current submission goes through here so the rule has one definition.

export interface SubmissionOrderingFields {
  id: string;
  milestone_id: string;
  created_at: string;
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function compareSubmissionsNewestFirst(
  a: SubmissionOrderingFields,
  b: SubmissionOrderingFields,
): number {
  const byCreatedAt = toTimestamp(b.created_at) - toTimestamp(a.created_at);
  if (byCreatedAt !== 0) {
    return byCreatedAt;
  }
  return b.id.localeCompare(a.id);
}

export function sortSubmissionsNewestFirst<T extends SubmissionOrderingFields>(
  submissions: readonly T[],
): T[] {
  return [...submissions].sort(compareSubmissionsNewestFirst);
}

/** One submission per milestone: the most recent revision of each. */
export function pickLatestSubmissionPerMilestone<T extends SubmissionOrderingFields>(
  submissions: readonly T[],
): T[] {
  const latestByMilestoneId = new Map<string, T>();

  for (const submission of sortSubmissionsNewestFirst(submissions)) {
    if (!latestByMilestoneId.has(submission.milestone_id)) {
      latestByMilestoneId.set(submission.milestone_id, submission);
    }
  }

  return sortSubmissionsNewestFirst(Array.from(latestByMilestoneId.values()));
}

/**
 * The evidence a student can attach to a Portfolio entry: the latest submission
 * for each milestone, plus the pinned submission when they pinned an older
 * revision — otherwise their own featured choice would disappear from the picker.
 */
export function selectPortfolioEvidence<T extends SubmissionOrderingFields>(
  submissions: readonly T[],
  featuredSubmissionId: string | null,
): T[] {
  const latest = pickLatestSubmissionPerMilestone(submissions);
  if (!featuredSubmissionId || latest.some((submission) => submission.id === featuredSubmissionId)) {
    return latest;
  }

  const featured = submissions.find((submission) => submission.id === featuredSubmissionId);
  if (!featured) {
    return latest;
  }

  return sortSubmissionsNewestFirst([...latest, featured]);
}
