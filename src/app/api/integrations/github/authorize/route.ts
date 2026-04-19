import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { requireApiStudent } from "@/lib/auth/api";
import {
  STATE_COOKIE_NAME,
  buildAuthorizeUrl,
  createStateCookieOptions,
} from "@/lib/integrations/github/oauth";
import { captureServerError } from "@/lib/sentry/server";

export async function GET() {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  try {
    const state = randomBytes(32).toString("base64url");
    const url = buildAuthorizeUrl(state);
    const res = NextResponse.redirect(url, { status: 302 });
    res.cookies.set(STATE_COOKIE_NAME, state, createStateCookieOptions());
    return res;
  } catch (error) {
    captureServerError(error, { route: "integrations/github/authorize" });
    return NextResponse.redirect(
      new URL("/settings/integrations?error=authorize_failed", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
      { status: 302 },
    );
  }
}
