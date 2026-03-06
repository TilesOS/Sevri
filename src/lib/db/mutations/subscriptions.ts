import { createAdminSupabaseClient } from "@/lib/supabase/admin";

interface UpsertSubscriptionInput {
  userId: string;
  plan: "free" | "pro_monthly";
  status: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  currentPeriodEnd?: string | null;
}

export async function upsertSubscription(input: UpsertSubscriptionInput) {
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: input.userId,
      plan: input.plan,
      status: input.status,
      stripe_customer_id: input.stripeCustomerId ?? null,
      stripe_subscription_id: input.stripeSubscriptionId ?? null,
      stripe_checkout_session_id: input.stripeCheckoutSessionId ?? null,
      current_period_end: input.currentPeriodEnd ?? null,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Failed to upsert subscription: ${error.message}`);
  }
}