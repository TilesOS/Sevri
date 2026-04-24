import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getPortfolioDisplayName(input: {
  userId: string;
  choice: "anonymous" | "real";
  admin?: boolean;
}) {
  if (input.choice === "anonymous") {
    return "A Sevri student";
  }

  const supabase = input.admin ? createAdminSupabaseClient() : await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, full_name")
    .eq("user_id", input.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load portfolio display name: ${error.message}`);
  }

  const displayName = typeof data?.display_name === "string" ? data.display_name.trim() : "";
  if (displayName) {
    return displayName;
  }

  const fullName = typeof data?.full_name === "string" ? data.full_name.trim() : "";
  if (fullName) {
    return fullName;
  }

  return "A Sevri student";
}
