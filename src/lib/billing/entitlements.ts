import type { Plan } from "@/types/domain";

export const ENTITLED_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due", "unpaid"] as const;

export function isEntitledSubscriptionStatus(status: string | null | undefined) {
  return status ? ENTITLED_SUBSCRIPTION_STATUSES.includes(status as (typeof ENTITLED_SUBSCRIPTION_STATUSES)[number]) : false;
}

export function hasVerifiedPlanAccess(plan: Plan | null | undefined, status: string | null | undefined) {
  return plan === "pro_monthly" && isEntitledSubscriptionStatus(status);
}
