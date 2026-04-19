import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getRequiredUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

export async function getAuthenticatedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

async function getUserRole(userId: string): Promise<"student" | "reviewer"> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("profiles")
    .select("user_role")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.user_role === "reviewer" ? "reviewer" : "student";
}

export async function getRequiredStudentUser() {
  const user = await getRequiredUser();
  const role = await getUserRole(user.id);
  if (role !== "student") {
    redirect("/reviewer");
  }
  return user;
}

export async function getRequiredReviewerUser() {
  const user = await getRequiredUser();
  const role = await getUserRole(user.id);
  if (role !== "reviewer") {
    redirect("/dashboard");
  }
  return user;
}
