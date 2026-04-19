import { decryptToken } from "@/lib/integrations/github/encryption";
import {
  GitHubNotConnectedError,
  GitHubRateLimitedError,
  GitHubRepoNotFoundError,
  GitHubTokenRevokedError,
} from "@/lib/integrations/github/errors";
import { getUserIntegrationWithToken } from "@/lib/db/queries/github";

const API_BASE = "https://api.github.com";

const STATIC_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "sevri-app",
} as const;

export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
}

export interface GitHubRepo {
  full_name: string;
  default_branch: string;
  private: boolean;
  html_url: string;
}

export interface GitHubCommit {
  sha: string;
  short_sha: string;
  message: string;
  message_title: string;
  message_body: string;
  author: {
    name: string;
    date: string;
    avatar_url: string | null;
  };
  html_url: string;
}

export interface GitHubReadme {
  content: string;
  sha: string;
}

export interface GitHubClient {
  getUser(): Promise<GitHubUser>;
  getRepo(fullName: string): Promise<GitHubRepo>;
  listCommits(
    fullName: string,
    opts?: { since?: string; until?: string; perPage?: number; sha?: string },
  ): Promise<GitHubCommit[]>;
  getReadme(fullName: string): Promise<GitHubReadme>;
}

interface RawGitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name?: string; date?: string } | null;
  };
  author: { avatar_url?: string } | null;
}

interface RawGitHubReadme {
  sha: string;
  content: string;
  encoding: string;
}

function summarizeCommit(raw: RawGitHubCommit): GitHubCommit {
  const message = raw.commit?.message ?? "";
  const newlineIndex = message.indexOf("\n");
  const title = newlineIndex === -1 ? message : message.slice(0, newlineIndex);
  const body =
    newlineIndex === -1 ? "" : message.slice(newlineIndex + 1).replace(/^\s+/, "");
  return {
    sha: raw.sha,
    short_sha: raw.sha.slice(0, 7),
    message,
    message_title: title.trim(),
    message_body: body.trim(),
    author: {
      name: raw.commit?.author?.name ?? "",
      date: raw.commit?.author?.date ?? "",
      avatar_url: raw.author?.avatar_url ?? null,
    },
    html_url: raw.html_url,
  };
}

async function ghFetch(token: string, path: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    headers: {
      ...STATIC_HEADERS,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
}

function rateLimited(res: Response): boolean {
  return res.status === 403 && res.headers.get("X-RateLimit-Remaining") === "0";
}

function buildClient(token: string): GitHubClient {
  return {
    async getUser() {
      const res = await ghFetch(token, "/user");
      if (res.status === 401) throw new GitHubTokenRevokedError();
      if (rateLimited(res)) throw new GitHubRateLimitedError();
      if (!res.ok) throw new Error(`GitHub /user failed: ${res.status}`);
      const body = (await res.json()) as {
        id: number;
        login: string;
        avatar_url: string;
      };
      return { id: body.id, login: body.login, avatar_url: body.avatar_url };
    },

    async getRepo(fullName) {
      const res = await ghFetch(token, `/repos/${fullName}`);
      if (res.status === 401) throw new GitHubTokenRevokedError();
      if (rateLimited(res)) throw new GitHubRateLimitedError();
      if (res.status === 404 || res.status === 403) throw new GitHubRepoNotFoundError();
      if (!res.ok) throw new Error(`GitHub /repos/${fullName} failed: ${res.status}`);
      const body = (await res.json()) as {
        full_name: string;
        default_branch: string;
        private: boolean;
        html_url: string;
      };
      return {
        full_name: body.full_name,
        default_branch: body.default_branch,
        private: body.private,
        html_url: body.html_url,
      };
    },

    async listCommits(fullName, opts) {
      const perPage = Math.min(Math.max(opts?.perPage ?? 30, 1), 100);
      const params = new URLSearchParams({ per_page: String(perPage) });
      if (opts?.since) params.set("since", opts.since);
      if (opts?.until) params.set("until", opts.until);
      if (opts?.sha) params.set("sha", opts.sha);
      const res = await ghFetch(token, `/repos/${fullName}/commits?${params.toString()}`);
      if (res.status === 401) throw new GitHubTokenRevokedError();
      if (rateLimited(res)) throw new GitHubRateLimitedError();
      if (res.status === 404 || res.status === 403) throw new GitHubRepoNotFoundError();
      if (!res.ok) throw new Error(`GitHub list commits failed: ${res.status}`);
      const body = (await res.json()) as RawGitHubCommit[];
      return body.map(summarizeCommit);
    },

    async getReadme(fullName) {
      const res = await ghFetch(token, `/repos/${fullName}/readme`);
      if (res.status === 401) throw new GitHubTokenRevokedError();
      if (rateLimited(res)) throw new GitHubRateLimitedError();
      if (res.status === 404 || res.status === 403) throw new GitHubRepoNotFoundError();
      if (!res.ok) throw new Error(`GitHub /readme failed: ${res.status}`);
      const body = (await res.json()) as RawGitHubReadme;
      const buf = Buffer.from(body.content ?? "", body.encoding === "base64" ? "base64" : "utf8");
      return { content: buf.toString("utf8"), sha: body.sha };
    },
  };
}

export async function createGitHubClient(userId: string): Promise<GitHubClient> {
  const integration = await getUserIntegrationWithToken(userId, "github");
  if (!integration || integration.status !== "active") {
    throw new GitHubNotConnectedError();
  }
  const token = decryptToken(integration.access_token_encrypted);
  return buildClient(token);
}

// Build a temporary client when we have a fresh token (e.g., right after the
// OAuth callback exchange) but no DB row yet.
export function createGitHubClientFromToken(token: string): GitHubClient {
  return buildClient(token);
}
