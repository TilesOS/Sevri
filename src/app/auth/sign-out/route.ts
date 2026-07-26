import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { applyPrivateAuthCacheHeaders } from "@/lib/supabase/response";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  return applyPrivateAuthCacheHeaders(
    NextResponse.redirect(new URL("/sign-in", request.url)),
  );
}
