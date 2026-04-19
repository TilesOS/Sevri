import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface UserIntegrationRow {
  id: string;
  user_id: string;
  provider: "github";
  access_token_encrypted: Buffer;
  refresh_token_encrypted: Buffer | null;
  token_expires_at: string | null;
  scopes: string[];
  provider_user_id: string;
  provider_username: string;
  status: "active" | "revoked" | "invalid";
  created_at: string;
  updated_at: string;
}

export interface UserIntegrationPublicRow {
  id: string;
  provider: "github";
  scopes: string[];
  provider_user_id: string;
  provider_username: string;
  status: "active" | "revoked" | "invalid";
  created_at: string;
  updated_at: string;
}

export interface ProjectGithubLinkRow {
  id: string;
  project_id: string;
  repo_full_name: string;
  default_branch: string;
  readme_sha: string | null;
  cached_commits: unknown;
  cached_readme: string | null;
  last_synced_at: string | null;
  status: "active" | "broken";
  created_at: string;
  updated_at: string;
}

const PUBLIC_INTEGRATION_COLUMNS =
  "id, provider, scopes, provider_user_id, provider_username, status, created_at, updated_at";

const FULL_INTEGRATION_COLUMNS =
  "id, user_id, provider, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, provider_user_id, provider_username, status, created_at, updated_at";

const FULL_LINK_COLUMNS =
  "id, project_id, repo_full_name, default_branch, readme_sha, cached_commits, cached_readme, last_synced_at, status, created_at, updated_at";

function decodeBytea(value: unknown): Buffer | null {
  if (value === null || value === undefined) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    if (value.startsWith("\\x")) {
      return Buffer.from(value.slice(2), "hex");
    }
    return Buffer.from(value, "base64");
  }
  return null;
}

export async function getUserIntegrationPublic(
  userId: string,
  provider: "github",
): Promise<UserIntegrationPublicRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("user_integrations")
    .select(PUBLIC_INTEGRATION_COLUMNS)
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load integration: ${error.message}`);
  }

  return (data as UserIntegrationPublicRow | null) ?? null;
}

// Returns the full row including encrypted token bytes. Uses the admin client
// because the encrypted bytea column is filtered from any client-facing read,
// and decryption only happens inside the integration client module.
export async function getUserIntegrationWithToken(
  userId: string,
  provider: "github",
): Promise<UserIntegrationRow | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("user_integrations")
    .select(FULL_INTEGRATION_COLUMNS)
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load integration: ${error.message}`);
  }
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const accessToken = decodeBytea(row.access_token_encrypted);
  if (!accessToken) {
    throw new Error("Encrypted access token is missing");
  }

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    provider: row.provider as "github",
    access_token_encrypted: accessToken,
    refresh_token_encrypted: decodeBytea(row.refresh_token_encrypted),
    token_expires_at: (row.token_expires_at as string | null) ?? null,
    scopes: (row.scopes as string[] | null) ?? [],
    provider_user_id: row.provider_user_id as string,
    provider_username: row.provider_username as string,
    status: row.status as "active" | "revoked" | "invalid",
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getProjectGithubLink(
  projectId: string,
): Promise<ProjectGithubLinkRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_github_links")
    .select(FULL_LINK_COLUMNS)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load GitHub link: ${error.message}`);
  }

  return (data as ProjectGithubLinkRow | null) ?? null;
}
