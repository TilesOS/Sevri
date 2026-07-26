import { NextResponse } from "next/server";

import { requireApiStudent } from "@/lib/auth/api";
import {
  consumeRateLimitReservation,
  enforceRateLimit,
  releaseRateLimitReservation,
} from "@/lib/usage/rate-limit";
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
import type { GitHubCommit, GitHubReadme } from "@/lib/integrations/github/client";
import {
  attributeCommitsToMilestones,
  type AttributionMilestone,
} from "@/lib/integrations/github/attribution";
import { captureServerError } from "@/lib/sentry/server";

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

function buildResponse(
  commits: GitHubCommit[],
  readme: GitHubReadme | null,
  lastSyncedAt: string,
  context: ProjectContext,
  stale = false,
) {
  const { attribution } = attributeCommitsToMilestones(
    commits,
    context.milestones,
    context.selectedAt,
  );
  return NextResponse.json({
    commits,
    attribution,
    readme,
    last_synced_at: lastSyncedAt,
    ...(stale ? { stale: true as const } : {}),
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) return response;

  const { id: projectId } = await context.params;

  let rateLimitReservationId: string | null = null;
  const limit = await enforceRateLimit({
    userId: user.id,
    endpoint: "github_activity",
    maxRequests: 60,
    windowMinutes: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { code: "rate_limited", resetAt: limit.resetAt },
      {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfterSeconds) },
      },
    );
  }
  rateLimitReservationId = limit.reservationId;

  try {
    const projectContext = await loadProjectContext(projectId, user.id).catch((error) => {
      captureServerError(error, { route: "github/activity", project_id: projectId });
      return null;
    });
    if (!projectContext) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const link = await loadCachedLink(projectId);
    if (!link) {
      return NextResponse.json({ code: "not_linked" }, { status: 404 });
    }
    if (link.status === "broken") {
      return NextResponse.json({ code: "repo_broken" }, { status: 410 });
    }

    if (isCacheFresh(link.last_synced_at)) {
      const cached = readCachedActivity(link);
      if (cached) {
        const completedReservationId = rateLimitReservationId;
        rateLimitReservationId = null;
        await consumeRateLimitReservation(completedReservationId);
        return buildResponse(cached.commits, cached.readme, cached.lastSyncedAt, projectContext);
      }
    }

    let commits: GitHubCommit[];
    try {
      const client = await createGitHubClient(user.id);
      commits = await client.listCommits(link.repo_full_name, {
        perPage: 100,
        sha: link.default_branch,
      });

      let readme: GitHubReadme | null = null;
      try {
        readme = await client.getReadme(link.repo_full_name);
      } catch (error) {
        if (error instanceof GitHubTokenRevokedError) {
          await markIntegrationInvalid(user.id, "github").catch((err) =>
            captureServerError(err, { route: "github/activity", step: "mark_invalid_readme" }),
          );
          return NextResponse.json({ code: "token_revoked" }, { status: 409 });
        }
        // README fetch failures (404, rate limit, repo broken) are non-fatal.
        readme = null;
      }

      const lastSyncedAt = await writeCachedActivity(projectId, { commits, readme });
      const completedReservationId = rateLimitReservationId;
      rateLimitReservationId = null;
      await consumeRateLimitReservation(completedReservationId);
      return buildResponse(commits, readme, lastSyncedAt, projectContext);
    } catch (error) {
      if (error instanceof GitHubTokenRevokedError) {
        await markIntegrationInvalid(user.id, "github").catch((err) =>
          captureServerError(err, { route: "github/activity", step: "mark_invalid" }),
        );
        return NextResponse.json({ code: "token_revoked" }, { status: 409 });
      }
      if (error instanceof GitHubRepoNotFoundError) {
        await markLinkBroken(projectId).catch((err) =>
          captureServerError(err, { route: "github/activity", step: "mark_broken" }),
        );
        return NextResponse.json({ code: "repo_broken" }, { status: 410 });
      }
      if (error instanceof GitHubRateLimitedError) {
        const cached = readCachedActivity(link);
        if (cached) {
          const completedReservationId = rateLimitReservationId;
          rateLimitReservationId = null;
          await consumeRateLimitReservation(completedReservationId);
          return buildResponse(cached.commits, cached.readme, cached.lastSyncedAt, projectContext, true);
        }
        return NextResponse.json({ code: "github_rate_limited" }, { status: 503 });
      }
      captureServerError(error, { route: "github/activity", step: "fetch" });
      return NextResponse.json({ error: "Failed to fetch GitHub activity." }, { status: 502 });
    }
  } finally {
    if (rateLimitReservationId) {
      await releaseRateLimitReservation(rateLimitReservationId).catch((releaseError) => {
        captureServerError(releaseError, {
          route: "github/activity",
          project_id: projectId,
          step: "release_rate_limit",
        });
      });
    }
  }
}
