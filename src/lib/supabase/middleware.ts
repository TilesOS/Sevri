import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clientEnv } from "@/lib/env";

const PROTECTED_PATHS = [
  "/dashboard",
  "/calendar",
  "/portfolio",
  "/onboarding",
  "/recommendations",
  "/project",
  "/projects",
  "/billing",
  "/settings",
  "/reviewer",
];
const STUDENT_ONLY_PATHS = [
  "/dashboard",
  "/calendar",
  "/portfolio",
  "/onboarding",
  "/recommendations",
  "/project",
  "/projects",
  "/billing",
  "/settings/billing",
];
const REVIEWER_ONLY_PATHS = ["/reviewer"];
const PUBLIC_BYPASS_PATHS = ["/accept-invitation"];
const AUTH_PATHS = ["/sign-in", "/sign-up"];

function matchesPath(pathname: string, paths: readonly string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  if (matchesPath(pathname, PUBLIC_BYPASS_PATHS)) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && matchesPath(pathname, PROTECTED_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = profile?.user_role === "reviewer" ? "reviewer" : "student";

  if (matchesPath(pathname, AUTH_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = role === "reviewer" ? "/reviewer" : "/dashboard";
    return NextResponse.redirect(url);
  }

  if (role === "reviewer" && matchesPath(pathname, STUDENT_ONLY_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/reviewer";
    return NextResponse.redirect(url);
  }

  if (role === "student" && matchesPath(pathname, REVIEWER_ONLY_PATHS)) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}
