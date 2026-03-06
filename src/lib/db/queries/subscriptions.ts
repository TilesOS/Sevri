import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Plan } from "@/types/domain";

export async function getUserPlan(userId: string): Promise<Plan> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch subscription: ${error.message}`);
  }

  if (!data) {
    return "free";
  }

  if (data.plan === "pro_monthly" && ["active", "trialing", "past_due"].includes(data.status)) {
    return "pro_monthly";
  }

  return "free";
}