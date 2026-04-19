import {
  getProjectGithubLink,
  type ProjectGithubLinkRow,
} from "@/lib/db/queries/github";
import { writeLinkCache } from "@/lib/db/mutations/github";
import type { GitHubCommit, GitHubReadme } from "@/lib/integrations/github/client";

const CACHE_TTL_MS = 5 * 60_000;

export interface CachedActivity {
  commits: GitHubCommit[];
  readme: GitHubReadme | null;
  lastSyncedAt: string;
}

export function isCacheFresh(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return false;
  const synced = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(synced)) return false;
  return Date.now() - synced < CACHE_TTL_MS;
}

export function readCachedActivity(link: ProjectGithubLinkRow): CachedActivity | null {
  if (!link.last_synced_at) return null;
  const commits = Array.isArray(link.cached_commits)
    ? (link.cached_commits as GitHubCommit[])
    : null;
  if (!commits) return null;
  const readme =
    link.cached_readme && link.readme_sha
      ? { content: link.cached_readme, sha: link.readme_sha }
      : null;
  return { commits, readme, lastSyncedAt: link.last_synced_at };
}

export async function loadCachedLink(projectId: string): Promise<ProjectGithubLinkRow | null> {
  return getProjectGithubLink(projectId);
}

export async function writeCachedActivity(
  projectId: string,
  payload: { commits: GitHubCommit[]; readme: GitHubReadme | null },
): Promise<string> {
  const lastSyncedAt = new Date().toISOString();
  await writeLinkCache(projectId, {
    cachedCommits: payload.commits,
    cachedReadme: payload.readme?.content ?? null,
    readmeSha: payload.readme?.sha ?? null,
    lastSyncedAt,
  });
  return lastSyncedAt;
}
