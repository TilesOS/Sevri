import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeRedirectPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
}

/**
 * Where a failed exchange should land. A password-recovery link is the one case
 * where the destination itself explains the failure and offers the fix, so those
 * failures go back to the request form with a reason rather than to a bare
 * sign-in page.
 */
function failureUrl(next: string, requestUrl: URL, reason: "link_invalid" | "link_missing") {
  const destination = next.startsWith("/reset-password") ? "/forgot-password" : "/sign-in";
  const url = new URL(destination, requestUrl);
  url.searchParams.set("error", reason);

  return url;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(failureUrl(next, requestUrl, "link_missing"));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(failureUrl(next, requestUrl, "link_invalid"));
  }

  return NextResponse.redirect(new URL(next, requestUrl));
}
