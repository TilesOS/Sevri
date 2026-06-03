import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  type ProjectGithubLinkRow,
  type UserIntegrationPublicRow,
} from "@/lib/db/queries/github";

export interface UpsertIntegrationInput {
  userId: string;
  provider: "github" | "google_calendar";
  accessTokenEncrypted: Buffer;
  refreshTokenEncrypted?: Buffer | null;
  tokenExpiresAt?: string | null;
  scopes: string[];
  providerUserId: string;
  providerUsername: string;
  status?: "active" | "revoked" | "invalid";
}

export async function upsertUserIntegration(
  input: UpsertIntegrationInput,
): Promise<UserIntegrationPublicRow> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("user_integrations")
    .upsert(
      {
        user_id: input.userId,
        provider: input.provider,
        access_token_encrypted: input.accessTokenEncrypted,
        refresh_token_encrypted: input.refreshTokenEncrypted ?? null,
        token_expires_at: input.tokenExpiresAt ?? null,
        scopes: input.scopes,
        provider_user_id: input.providerUserId,
        provider_username: input.providerUsername,
        status: input.status ?? "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,provider" },
    )
    .select(
      "id, provider, scopes, provider_user_id, provider_username, status, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(`Failed to upsert integration: ${error?.message ?? "unknown"}`);
  }

  return data as UserIntegrationPublicRow;
}

export async function markIntegrationInvalid(
  userId: string,
  provider: "github" | "google_calendar",
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("user_integrations")
    .update({ status: "invalid", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) {
    throw new Error(`Failed to mark integration invalid: ${error.message}`);
  }
}

export async function deleteUserIntegration(
  userId: string,
  provider: "github" | "google_calendar",
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("user_integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", provider);

  if (error) {
    throw new Error(`Failed to delete integration: ${error.message}`);
  }
}

export async function updateUserIntegrationTokens(input: {
  userId: string;
  provider: "github" | "google_calendar";
  accessTokenEncrypted: Buffer;
  refreshTokenEncrypted?: Buffer | null;
  tokenExpiresAt?: string | null;
  status?: "active" | "revoked" | "invalid";
}): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const update: Record<string, unknown> = {
    access_token_encrypted: input.accessTokenEncrypted,
    token_expires_at: input.tokenExpiresAt ?? null,
    status: input.status ?? "active",
    updated_at: new Date().toISOString(),
  };

  if (input.refreshTokenEncrypted !== undefined) {
    update.refresh_token_encrypted = input.refreshTokenEncrypted;
  }

  const { error } = await supabase
    .from("user_integrations")
    .update(update)
    .eq("user_id", input.userId)
    .eq("provider", input.provider);

  if (error) {
    throw new Error(`Failed to update integration tokens: ${error.message}`);
  }
}

export async function deleteProjectGithubLinksForUser(userId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId);

  if (projectsError) {
    throw new Error(`Failed to load user projects: ${projectsError.message}`);
  }

  const projectIds = (projects ?? [])
    .map((project) => project.id)
    .filter((id): id is string => typeof id === "string");

  if (projectIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("project_github_links")
    .delete()
    .in("project_id", projectIds);

  if (error) {
    throw new Error(`Failed to delete GitHub links: ${error.message}`);
  }
}

export interface UpsertLinkInput {
  projectId: string;
  repoFullName: string;
  defaultBranch: string;
  status?: "active" | "broken";
}

export async function upsertProjectGithubLink(
  input: UpsertLinkInput,
): Promise<ProjectGithubLinkRow> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("project_github_links")
    .upsert(
      {
        project_id: input.projectId,
        repo_full_name: input.repoFullName,
        default_branch: input.defaultBranch,
        readme_sha: null,
        cached_commits: null,
        cached_readme: null,
        last_synced_at: null,
        status: input.status ?? "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" },
    )
    .select(
      "id, project_id, repo_full_name, default_branch, readme_sha, cached_commits, cached_readme, last_synced_at, status, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(`Failed to upsert GitHub link: ${error?.message ?? "unknown"}`);
  }

  return data as ProjectGithubLinkRow;
}

export async function markLinkBroken(projectId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("project_github_links")
    .update({ status: "broken", updated_at: new Date().toISOString() })
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to mark link broken: ${error.message}`);
  }
}

export async function deleteProjectGithubLink(projectId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("project_github_links")
    .delete()
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to delete GitHub link: ${error.message}`);
  }
}

export interface CachePayload {
  cachedCommits: unknown;
  cachedReadme: string | null;
  readmeSha: string | null;
  lastSyncedAt: string;
}

export async function writeLinkCache(
  projectId: string,
  cache: CachePayload,
): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("project_github_links")
    .update({
      cached_commits: cache.cachedCommits,
      cached_readme: cache.cachedReadme,
      readme_sha: cache.readmeSha,
      last_synced_at: cache.lastSyncedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);

  if (error) {
    throw new Error(`Failed to write link cache: ${error.message}`);
  }
}
