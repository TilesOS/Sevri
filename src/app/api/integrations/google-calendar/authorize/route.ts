import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { clientEnv } from "@/lib/env";
import {
  GOOGLE_CALENDAR_STATE_COOKIE_NAME,
  buildGoogleCalendarAuthorizeUrl,
  createGoogleCalendarStateCookieOptions,
} from "@/lib/integrations/google-calendar/oauth";
import { captureServerError } from "@/lib/sentry/server";

export async function GET() {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  try {
    const state = randomBytes(32).toString("base64url");
    const url = buildGoogleCalendarAuthorizeUrl(state);
    const res = NextResponse.redirect(url, { status: 302 });
    res.cookies.set(GOOGLE_CALENDAR_STATE_COOKIE_NAME, state, createGoogleCalendarStateCookieOptions());
    return res;
  } catch (error) {
    captureServerError(error, { route: "integrations/google-calendar/authorize" });
    return NextResponse.redirect(
      new URL("/settings/integrations?error=google_calendar_authorize_failed", clientEnv.NEXT_PUBLIC_SITE_URL),
      { status: 302 },
    );
  }
}

