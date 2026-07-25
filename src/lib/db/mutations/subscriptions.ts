import { createAdminSupabaseClient } from "@/lib/supabase/admin";

interface UpsertSubscriptionInput {
  userId: string;
  plan: "free" | "pro_monthly";
  status: string;
  /** Omit to leave the stored value untouched; pass null to clear it. */
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  currentPeriodEnd?: string | null;
}

export async function upsertSubscription(input: UpsertSubscriptionInput) {
  const supabase = createAdminSupabaseClient();

  // Only the keys present here are written on conflict, so a webhook that knows
  // nothing about the checkout session no longer erases the stored ids that
  // reconciliation depends on.
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    plan: input.plan,
    status: input.status,
  };

  if (input.stripeCustomerId !== undefined) {
    payload.stripe_customer_id = input.stripeCustomerId;
  }

  if (input.stripeSubscriptionId !== undefined) {
    payload.stripe_subscription_id = input.stripeSubscriptionId;
  }

  if (input.stripeCheckoutSessionId !== undefined) {
    payload.stripe_checkout_session_id = input.stripeCheckoutSessionId;
  }

  if (input.currentPeriodEnd !== undefined) {
    payload.current_period_end = input.currentPeriodEnd;
  }

  const { error } = await supabase.from("subscriptions").upsert(payload, { onConflict: "user_id" });

  if (error) {
    throw new Error(`Failed to upsert subscription: ${error.message}`);
  }
}
