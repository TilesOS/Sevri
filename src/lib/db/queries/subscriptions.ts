import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasVerifiedPlanAccess } from "@/lib/billing/entitlements";
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

  if (hasVerifiedPlanAccess(data.plan === "pro_monthly" ? "pro_monthly" : "free", data.status)) {
    return "pro_monthly";
  }

  return "free";
}
