import { getGithubEnv } from "@/lib/env";

const STATE_COOKIE_SECURE = process.env.NODE_ENV === "production";

export const STATE_COOKIE_NAME = STATE_COOKIE_SECURE
  ? "__Host-gh_oauth_state"
  : "gh_oauth_state";
export const STATE_COOKIE_MAX_AGE_SECONDS = 600;
export const REQUESTED_SCOPES = ["public_repo", "read:user"] as const;

export interface StateCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

export function createStateCookieOptions(): StateCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: STATE_COOKIE_SECURE,
    path: "/",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
  };
}

export function buildAuthorizeUrl(state: string): string {
  const env = getGithubEnv();
  const params = new URLSearchParams({
    client_id: env.GITHUB_CLIENT_ID,
    redirect_uri: env.GITHUB_REDIRECT_URI,
    scope: REQUESTED_SCOPES.join(" "),
    state,
    allow_signup: "false",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export interface ExchangeCodeResult {
  access_token: string;
  scope: string;
  token_type: "bearer";
}

export async function exchangeCodeForToken(code: string): Promise<ExchangeCodeResult> {
  const env = getGithubEnv();
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "sevri-app",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_REDIRECT_URI,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: HTTP ${res.status}`);
  }

  const data = (await res.json()) as Partial<ExchangeCodeResult> & {
    error?: string;
    error_description?: string;
  };

  if (data.error) {
    throw new Error(`GitHub token exchange error: ${data.error}`);
  }

  if (!data.access_token || data.token_type !== "bearer" || typeof data.scope !== "string") {
    throw new Error("GitHub token exchange returned an unexpected payload");
  }

  return {
    access_token: data.access_token,
    scope: data.scope,
    token_type: "bearer",
  };
}

// GitHub OAuth App tokens do not expire by default. Stub kept so the call
// site signature is stable if we ever migrate to a GitHub App.
export async function refreshToken(): Promise<never> {
  throw new Error("Token refresh is not supported for GitHub OAuth Apps in v1");
}
