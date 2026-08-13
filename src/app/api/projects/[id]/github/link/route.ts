import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiStudent } from "@/lib/auth/api";
import {
  assertFeatureAccess,
  createUpgradeRequiredResponse,
} from "@/lib/usage/feature-access";
import {
  upsertProjectGithubLink,
  deleteProjectGithubLink,
  markIntegrationInvalid,
} from "@/lib/db/mutations/github";
import { getUserIntegrationPublic } from "@/lib/db/queries/github";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createGitHubClient } from "@/lib/integrations/github/client";
import {
  GitHubRepoNotFoundError,
  GitHubTokenRevokedError,
} from "@/lib/integrations/github/errors";
import { captureServerError } from "@/lib/sentry/server";

const linkGithubRepoSchema = z.object({
  repo_full_name: z.string().regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/),
});

async function loadOwnedProject(projectId: string, userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load project: ${error.message}`);
  }
  if (!data || data.user_id !== userId) {
    return null;
  }
  return data;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) return response;

  const { id: projectId } = await context.params;

  let payload: z.infer<typeof linkGithubRepoSchema>;
  try {
    payload = linkGithubRepoSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request", details: error instanceof z.ZodError ? error.flatten() : undefined },
      { status: 400 },
    );
  }

  const access = await assertFeatureAccess({ userId: user.id, feature: "link_github" });
  if (!access.allowed) {
    return createUpgradeRequiredResponse(access.error);
  }

  let project: Awaited<ReturnType<typeof loadOwnedProject>>;
  try {
    project = await loadOwnedProject(projectId, user.id);
  } catch (error) {
    captureServerError(error, { route: "github/link", project_id: projectId });
    return NextResponse.json({ error: "Failed to load project." }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  const integration = await getUserIntegrationPublic(user.id, "github");
  if (!integration || integration.status !== "active") {
    return NextResponse.json(
      { code: "not_connected", message: "Connect GitHub first." },
      { status: 409 },
    );
  }

  let repo: Awaited<ReturnType<Awaited<ReturnType<typeof createGitHubClient>>["getRepo"]>>;
  try {
    const client = await createGitHubClient(user.id);
    repo = await client.getRepo(payload.repo_full_name);
  } catch (error) {
    if (error instanceof GitHubTokenRevokedError) {
      await markIntegrationInvalid(user.id, "github").catch((err) =>
        captureServerError(err, { route: "github/link", step: "mark_invalid" }),
      );
      return NextResponse.json({ code: "token_revoked" }, { status: 409 });
    }
    if (error instanceof GitHubRepoNotFoundError) {
      return NextResponse.json({ code: "repo_not_found" }, { status: 404 });
    }
    captureServerError(error, { route: "github/link", step: "getRepo" });
    return NextResponse.json({ error: "Failed to fetch repository." }, { status: 502 });
  }

  if (repo.private) {
    return NextResponse.json(
      {
        code: "private_repo",
        message:
          "Sevri can only link public repos in v1. Make it public or wait for a future version.",
      },
      { status: 400 },
    );
  }

  try {
    const link = await upsertProjectGithubLink({
      projectId: project.id,
      repoFullName: repo.full_name,
      defaultBranch: repo.default_branch,
      status: "active",
    });
    return NextResponse.json({ link }, { status: 201 });
  } catch (error) {
    captureServerError(error, { route: "github/link", step: "upsert" });
    return NextResponse.json({ error: "Failed to save GitHub link." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) return response;

  const { id: projectId } = await context.params;

  const project = await loadOwnedProject(projectId, user.id).catch((error) => {
    captureServerError(error, { route: "github/unlink", project_id: projectId });
    return null;
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  try {
    await deleteProjectGithubLink(project.id);
    return NextResponse.json({ status: "unlinked" }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "github/unlink", step: "delete" });
    return NextResponse.json({ error: "Failed to unlink." }, { status: 500 });
  }
}
