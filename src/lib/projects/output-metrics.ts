interface CommitLike {
  sha?: unknown;
  author?: {
    date?: unknown;
  } | null;
}

export interface ProjectOutputMetrics {
  commitCount: number;
  wordCount: number;
}

const WORD_PATTERN = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;

function toTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  return Array.from(text.matchAll(WORD_PATTERN)).length;
}

export function countProjectCommits(
  cachedCommits: unknown,
  selectedAt: string | null | undefined,
): number {
  if (!Array.isArray(cachedCommits)) return 0;

  const selectedAtTime = toTime(selectedAt);
  const seenShas = new Set<string>();

  for (const candidate of cachedCommits) {
    if (!candidate || typeof candidate !== "object") continue;

    const commit = candidate as CommitLike;
    const sha = typeof commit.sha === "string" ? commit.sha.trim() : "";
    if (!sha || seenShas.has(sha)) continue;

    const authoredAt = typeof commit.author?.date === "string" ? commit.author.date : null;
    const authoredAtTime = toTime(authoredAt);
    if (selectedAtTime !== null && authoredAtTime !== null && authoredAtTime < selectedAtTime) {
      continue;
    }

    seenShas.add(sha);
  }

  return seenShas.size;
}

export function emptyProjectOutputMetrics(): ProjectOutputMetrics {
  return {
    commitCount: 0,
    wordCount: 0,
  };
}
