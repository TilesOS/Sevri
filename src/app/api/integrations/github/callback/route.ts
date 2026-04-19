import { NextResponse, type NextRequest } from "next/server";

import { requireApiStudent } from "@/lib/auth/api";
import { upsertUserIntegration } from "@/lib/db/mutations/github";
import { clientEnv } from "@/lib/env";
import { createGitHubClientFromToken } from "@/lib/integrations/github/client";
import { encryptToken } from "@/lib/integrations/github/encryption";
import {
  STATE_COOKIE_NAME,
  exchangeCodeForToken,
} from "@/lib/integrations/github/oauth";
import { captureServerError } from "@/lib/sentry/server";

function redirectTo(path: string) {
  const url = new URL(path, clientEnv.NEXT_PUBLIC_SITE_URL);
  const res = NextResponse.redirect(url, { status: 302 });
  res.cookies.delete(STATE_COOKIE_NAME);
  return res;
}

export async function GET(request: NextRequest) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(STATE_COOKIE_NAME)?.value ?? null;

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo("/settings/integrations?error=state_mismatch");
  }

  let token: { access_token: string; scope: string };
  try {
    token = await exchangeCodeForToken(code);
  } catch (error) {
    captureServerError(error, { route: "integrations/github/callback", step: "exchange" });
    return redirectTo("/settings/integrations?error=code_exchange_failed");
  }

  let ghUser: Awaited<ReturnType<ReturnType<typeof createGitHubClientFromToken>["getUser"]>>;
  try {
    const tempClient = createGitHubClientFromToken(token.access_token);
    ghUser = await tempClient.getUser();
  } catch (error) {
    captureServerError(error, { route: "integrations/github/callback", step: "getUser" });
    return redirectTo("/settings/integrations?error=user_fetch_failed");
  }

  const scopes = token.scope
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const hasRequiredScopes =
    scopes.includes("public_repo") && scopes.includes("read:user");

  try {
    await upsertUserIntegration({
      userId: user.id,
      provider: "github",
      accessTokenEncrypted: encryptToken(token.access_token),
      scopes,
      providerUserId: String(ghUser.id),
      providerUsername: ghUser.login,
      status: hasRequiredScopes ? "active" : "invalid",
    });
  } catch (error) {
    captureServerError(error, { route: "integrations/github/callback", step: "upsert" });
    return redirectTo("/settings/integrations?error=persist_failed");
  }

  if (!hasRequiredScopes) {
    return redirectTo("/settings/integrations?error=missing_scopes");
  }

  return redirectTo("/settings/integrations?connected=github");
}
