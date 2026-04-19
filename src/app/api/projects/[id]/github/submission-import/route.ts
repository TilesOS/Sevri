import { NextResponse } from "next/server";

import { requireApiStudent } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createGitHubClient } from "@/lib/integrations/github/client";
import {
  GitHubRateLimitedError,
  GitHubRepoNotFoundError,
  GitHubTokenRevokedError,
} from "@/lib/integrations/github/errors";
import {
  isCacheFresh,
  loadCachedLink,
  readCachedActivity,
  writeCachedActivity,
} from "@/lib/integrations/github/cache";
import {
  markIntegrationInvalid,
  markLinkBroken,
} from "@/lib/db/mutations/github";
import {
  attributeCommitsToMilestones,
  type AttributionMilestone,
} from "@/lib/integrations/github/attribution";
import type { GitHubCommit, GitHubReadme } from "@/lib/integrations/github/client";
import { captureServerError } from "@/lib/sentry/server";

const MAX_SUBMISSION_CHARS = 20_000;
const TRUNCATION_SUFFIX = "\n\n…truncated — see full history on GitHub.";

function formatCommits(commits: GitHubCommit[]): { content: string; truncated: boolean } {
  const blocks = commits.map((c) => {
    const header = `${c.message_title} (${c.short_sha})`;
    return c.message_body ? `${header}\n${c.message_body}` : header;
  });
  const full = blocks.join("\n\n");
  if (full.length <= MAX_SUBMISSION_CHARS) {
    return { content: full, truncated: false };
  }
  const budget = MAX_SUBMISSION_CHARS - TRUNCATION_SUFFIX.length;
  return {
    content: `${full.slice(0, Math.max(budget, 0))}${TRUNCATION_SUFFIX}`,
    truncated: true,
  };
}

interface ProjectContext {
  selectedAt: string | null;
  milestones: AttributionMilestone[];
}

async function loadProjectContext(
  projectId: string,
  userId: string,
): Promise<ProjectContext | null> {
  const supabase = await createServerSupabaseClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, user_id, selected_at")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError) {
    throw new Error(`Failed to load project: ${projectError.message}`);
  }
  if (!project || project.user_id !== userId) return null;

  const { data: milestones, error: milestonesError } = await supabase
    .from("milestones")
    .select("id, order_index, completed, completed_at")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });
  if (milestonesError) {
    throw new Error(`Failed to load milestones: ${milestonesError.message}`);
  }

  return {
    selectedAt: (project.selected_at as string | null) ?? null,
    milestones: (milestones ?? []) as AttributionMilestone[],
  };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) return response;

  const { id: projectId } = await context.params;
  const milestoneId = new URL(request.url).searchParams.get("milestone_id");
  if (!milestoneId) {
    return NextResponse.json(
      { error: "milestone_id query param is required." },
      { status: 400 },
    );
  }

  const projectContext = await loadProjectContext(projectId, user.id).catch((error) => {
    captureServerError(error, { route: "github/submission-import", project_id: projectId });
    return null;
  });
  if (!projectContext) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!projectContext.milestones.some((m) => m.id === milestoneId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const link = await loadCachedLink(projectId);
  if (!link) {
    return NextResponse.json({ code: "not_linked" }, { status: 404 });
  }
  if (link.status === "broken") {
    return NextResponse.json({ code: "repo_broken" }, { status: 410 });
  }

  let commits: GitHubCommit[] | null = null;
  if (isCacheFresh(link.last_synced_at)) {
    const cached = readCachedActivity(link);
    if (cached) commits = cached.commits;
  }

  if (!commits) {
    try {
      const client = await createGitHubClient(user.id);
      commits = await client.listCommits(link.repo_full_name, {
        perPage: 100,
        sha: link.default_branch,
      });
      let readme: GitHubReadme | null = null;
      try {
        readme = await client.getReadme(link.repo_full_name);
      } catch {
        readme = null;
      }
      await writeCachedActivity(projectId, { commits, readme });
    } catch (error) {
      if (error instanceof GitHubTokenRevokedError) {
        await markIntegrationInvalid(user.id, "github").catch((err) =>
          captureServerError(err, { route: "github/submission-import", step: "mark_invalid" }),
        );
        return NextResponse.json({ code: "token_revoked" }, { status: 409 });
      }
      if (error instanceof GitHubRepoNotFoundError) {
        await markLinkBroken(projectId).catch((err) =>
          captureServerError(err, { route: "github/submission-import", step: "mark_broken" }),
        );
        return NextResponse.json({ code: "repo_broken" }, { status: 410 });
      }
      if (error instanceof GitHubRateLimitedError) {
        const cached = readCachedActivity(link);
        if (cached) {
          commits = cached.commits;
        } else {
          return NextResponse.json({ code: "github_rate_limited" }, { status: 503 });
        }
      } else {
        captureServerError(error, { route: "github/submission-import", step: "fetch" });
        return NextResponse.json({ error: "Failed to fetch GitHub activity." }, { status: 502 });
      }
    }
  }

  const safeCommits = commits ?? [];
  const { attribution } = attributeCommitsToMilestones(
    safeCommits,
    projectContext.milestones,
    projectContext.selectedAt,
  );
  const shas = new Set(attribution[milestoneId] ?? []);
  const filtered = safeCommits.filter((c) => shas.has(c.sha));
  const { content, truncated } = formatCommits(filtered);

  return NextResponse.json({
    content,
    commit_count: filtered.length,
    truncated,
  });
}
