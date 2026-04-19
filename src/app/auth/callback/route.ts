import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function safeRedirectPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/dashboard";
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in", requestUrl));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/sign-in", requestUrl));
  }

  return NextResponse.redirect(new URL(next, requestUrl));
}
