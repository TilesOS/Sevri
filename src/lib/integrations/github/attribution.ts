import type { GitHubCommit } from "@/lib/integrations/github/client";

export interface AttributionMilestone {
  id: string;
  order_index: number;
  completed: boolean;
  completed_at: string | null;
}

export interface AttributionResult {
  attribution: Record<string, string[]>;
  unattributed: string[];
}

function toMs(value: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function attributeCommitsToMilestones(
  commits: GitHubCommit[],
  milestones: AttributionMilestone[],
  projectStartedAt: string | null,
): AttributionResult {
  const ordered = [...milestones].sort((a, b) => a.order_index - b.order_index);
  const projectStartMs = toMs(projectStartedAt);
  const nowMs = Date.now();

  const windows = ordered.map((m, i) => {
    const previousCompleted = i === 0 ? null : toMs(ordered[i - 1].completed_at);
    const startCandidates = [previousCompleted, projectStartMs].filter(
      (v): v is number => v !== null,
    );
    const start = startCandidates.length > 0 ? Math.max(...startCandidates) : 0;
    const end = m.completed && m.completed_at ? (toMs(m.completed_at) ?? nowMs) : nowMs;
    return { id: m.id, start, end };
  });

  const attribution: Record<string, string[]> = {};
  const unattributed: string[] = [];

  for (const commit of commits) {
    const ms = toMs(commit.author?.date ?? null);
    if (ms === null) {
      unattributed.push(commit.sha);
      continue;
    }
    const bucket = windows.find((w) => ms >= w.start && ms < w.end);
    if (!bucket) {
      unattributed.push(commit.sha);
      continue;
    }
    if (!attribution[bucket.id]) attribution[bucket.id] = [];
    attribution[bucket.id].push(commit.sha);
  }

  return { attribution, unattributed };
}
