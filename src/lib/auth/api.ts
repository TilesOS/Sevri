import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RequireResult =
  | { user: User; response: null }
  | { user: null; response: NextResponse };

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function requireApiUser(): Promise<RequireResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return {
        user: null,
        response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    return { user, response: null };
  } catch (error) {
    throw new Error(`Auth bootstrap failed: ${getErrorMessage(error)}`);
  }
}

async function resolveRole(userId: string): Promise<"student" | "reviewer"> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.user_role === "reviewer" ? "reviewer" : "student";
}

export async function requireApiStudent(): Promise<RequireResult> {
  const result = await requireApiUser();
  if (!result.user) {
    return result;
  }

  const role = await resolveRole(result.user.id);
  if (role !== "student") {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden", code: "wrong_role" }, { status: 403 }),
    };
  }

  return result;
}

export async function requireApiReviewer(): Promise<RequireResult> {
  const result = await requireApiUser();
  if (!result.user) {
    return result;
  }

  const role = await resolveRole(result.user.id);
  if (role !== "reviewer") {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden", code: "wrong_role" }, { status: 403 }),
    };
  }

  return result;
}
