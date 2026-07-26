import { NextResponse } from "next/server";
import { copySessionResponseState } from "@/lib/supabase/response-state";

export function copyNextSessionResponseState(source: NextResponse, target: NextResponse) {
  return copySessionResponseState(source, target, {
    setCookie(response, cookie) {
      response.cookies.set(cookie);
    },
    setHeader(response, name, value) {
      response.headers.set(name, value);
    },
  });
}

/**
 * Redirects must carry the cookies and cache protections written while
 * Supabase refreshed the request session.
 */
export function createSessionPreservingRedirect(destination: URL, sessionResponse: NextResponse) {
  return copyNextSessionResponseState(sessionResponse, NextResponse.redirect(destination));
}

export function applyPrivateAuthCacheHeaders(response: NextResponse) {
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
