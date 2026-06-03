import { getGoogleCalendarEnv } from "@/lib/env";

const STATE_COOKIE_SECURE = process.env.NODE_ENV === "production";

export const GOOGLE_CALENDAR_STATE_COOKIE_NAME = STATE_COOKIE_SECURE
  ? "__Host-gcal_oauth_state"
  : "gcal_oauth_state";
export const GOOGLE_CALENDAR_STATE_COOKIE_MAX_AGE_SECONDS = 600;
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.app.created";
export const REQUESTED_GOOGLE_CALENDAR_SCOPES = ["openid", "email", GOOGLE_CALENDAR_SCOPE] as const;

export interface StateCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: "Bearer";
  id_token?: string;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
}

export function createGoogleCalendarStateCookieOptions(): StateCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: STATE_COOKIE_SECURE,
    path: "/",
    maxAge: GOOGLE_CALENDAR_STATE_COOKIE_MAX_AGE_SECONDS,
  };
}

export function buildGoogleCalendarAuthorizeUrl(state: string): string {
  const env = getGoogleCalendarEnv();
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
    redirect_uri: env.GOOGLE_CALENDAR_REDIRECT_URI,
    response_type: "code",
    scope: REQUESTED_GOOGLE_CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function buildTokenExpiresAt(expiresInSeconds: number) {
  return new Date(Date.now() + Math.max(expiresInSeconds - 60, 60) * 1000).toISOString();
}

async function parseTokenResponse(response: Response): Promise<GoogleTokenResponse> {
  const data = (await response.json().catch(() => null)) as Partial<GoogleTokenResponse> & {
    error?: string;
    error_description?: string;
  } | null;

  if (!response.ok || data?.error) {
    throw new Error(`Google token request failed: ${data?.error_description ?? data?.error ?? `HTTP ${response.status}`}`);
  }

  if (!data?.access_token || data.token_type !== "Bearer" || typeof data.expires_in !== "number") {
    throw new Error("Google token request returned an unexpected payload.");
  }

  return data as GoogleTokenResponse;
}

export async function exchangeGoogleCalendarCodeForToken(code: string): Promise<{
  token: GoogleTokenResponse;
  tokenExpiresAt: string;
}> {
  const env = getGoogleCalendarEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: env.GOOGLE_CALENDAR_REDIRECT_URI,
    }),
  });
  const token = await parseTokenResponse(response);

  return {
    token,
    tokenExpiresAt: buildTokenExpiresAt(token.expires_in),
  };
}

export async function refreshGoogleCalendarToken(refreshToken: string): Promise<{
  token: GoogleTokenResponse;
  tokenExpiresAt: string;
}> {
  const env = getGoogleCalendarEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CALENDAR_CLIENT_ID,
      client_secret: env.GOOGLE_CALENDAR_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const token = await parseTokenResponse(response);

  return {
    token,
    tokenExpiresAt: buildTokenExpiresAt(token.expires_in),
  };
}

function decodeBase64UrlJson(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

export function decodeGoogleIdentity(idToken: string | undefined): GoogleIdentity {
  if (!idToken) {
    throw new Error("Google did not return an identity token.");
  }

  const [, payload] = idToken.split(".");
  if (!payload) {
    throw new Error("Google returned an invalid identity token.");
  }

  const parsed = decodeBase64UrlJson(payload);
  const sub = typeof parsed.sub === "string" ? parsed.sub : "";
  const email = typeof parsed.email === "string" ? parsed.email : "";

  if (!sub || !email) {
    throw new Error("Google identity token is missing account information.");
  }

  return { sub, email };
}

