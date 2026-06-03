import { NextResponse, type NextRequest } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { upsertGoogleCalendarSyncSettings } from "@/lib/db/mutations/google-calendar";
import { upsertUserIntegration } from "@/lib/db/mutations/github";
import { getCalendarPageData } from "@/lib/db/queries/calendar";
import { clientEnv } from "@/lib/env";
import { encryptToken } from "@/lib/integrations/github/encryption";
import {
  GOOGLE_CALENDAR_SCOPE,
  GOOGLE_CALENDAR_STATE_COOKIE_NAME,
  decodeGoogleIdentity,
  exchangeGoogleCalendarCodeForToken,
} from "@/lib/integrations/google-calendar/oauth";
import { syncProjectToGoogleCalendar } from "@/lib/integrations/google-calendar/sync";
import { captureServerError } from "@/lib/sentry/server";

function redirectTo(path: string) {
  const url = new URL(path, clientEnv.NEXT_PUBLIC_SITE_URL);
  const res = NextResponse.redirect(url, { status: 302 });
  res.cookies.delete(GOOGLE_CALENDAR_STATE_COOKIE_NAME);
  return res;
}

function normalizeScopes(value: string | undefined) {
  return (value ?? "")
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(GOOGLE_CALENDAR_STATE_COOKIE_NAME)?.value ?? null;

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo("/settings/integrations?error=google_calendar_state_mismatch");
  }

  let tokenResult: Awaited<ReturnType<typeof exchangeGoogleCalendarCodeForToken>>;
  try {
    tokenResult = await exchangeGoogleCalendarCodeForToken(code);
  } catch (error) {
    captureServerError(error, { route: "integrations/google-calendar/callback", step: "exchange" });
    return redirectTo("/settings/integrations?error=google_calendar_code_exchange_failed");
  }

  let identity: ReturnType<typeof decodeGoogleIdentity>;
  try {
    identity = decodeGoogleIdentity(tokenResult.token.id_token);
  } catch (error) {
    captureServerError(error, { route: "integrations/google-calendar/callback", step: "identity" });
    return redirectTo("/settings/integrations?error=google_calendar_identity_failed");
  }

  const scopes = normalizeScopes(tokenResult.token.scope);
  const hasRequiredScope = scopes.includes(GOOGLE_CALENDAR_SCOPE);
  const refreshToken = tokenResult.token.refresh_token;

  let integration: Awaited<ReturnType<typeof upsertUserIntegration>>;
  try {
    integration = await upsertUserIntegration({
      userId: user.id,
      provider: "google_calendar",
      accessTokenEncrypted: encryptToken(tokenResult.token.access_token),
      refreshTokenEncrypted: refreshToken ? encryptToken(refreshToken) : undefined,
      tokenExpiresAt: tokenResult.tokenExpiresAt,
      scopes,
      providerUserId: identity.sub,
      providerUsername: identity.email,
      status: hasRequiredScope && refreshToken ? "active" : "invalid",
    });

    await upsertGoogleCalendarSyncSettings({
      userId: user.id,
      integrationId: integration.id,
      calendarSummary: "Sevri",
      syncEnabled: true,
      status: hasRequiredScope && refreshToken ? "active" : "invalid",
      lastError: refreshToken ? null : "Google did not provide a refresh token. Reconnect Google Calendar.",
    });
  } catch (error) {
    captureServerError(error, { route: "integrations/google-calendar/callback", step: "persist" });
    return redirectTo("/settings/integrations?error=google_calendar_persist_failed");
  }

  if (!hasRequiredScope) {
    return redirectTo("/settings/integrations?error=google_calendar_missing_scopes");
  }

  if (!refreshToken) {
    return redirectTo("/settings/integrations?error=google_calendar_missing_refresh_token");
  }

  try {
    const calendarData = await getCalendarPageData(user.id);
    for (const project of calendarData.projects) {
      await syncProjectToGoogleCalendar({
        userId: user.id,
        project,
      });
    }
  } catch (error) {
    captureServerError(error, { route: "integrations/google-calendar/callback", step: "initial-sync" });
    return redirectTo("/settings/integrations?connected=google_calendar&error=google_calendar_initial_sync_failed");
  }

  return redirectTo("/settings/integrations?connected=google_calendar");
}

