import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { getServerEnv } from "@/lib/env";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { upsertSubscription } from "@/lib/db/mutations/subscriptions";

const env = getServerEnv();

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing", "past_due", "unpaid"]);

function planFromSubscription(subscription: Stripe.Subscription): "free" | "pro_monthly" {
  const activePriceIds = subscription.items.data.map((item) => item.price.id);
  if (activePriceIds.includes(env.STRIPE_PRICE_PRO_MONTHLY)) {
    return "pro_monthly";
  }

  return "free";
}

function statusRank(status: Stripe.Subscription.Status) {
  if (status === "active") return 4;
  if (status === "trialing") return 3;
  if (status === "past_due" || status === "unpaid") return 2;
  if (status === "incomplete") return 1;
  return 0;
}

function chooseBestSubscription(subscriptions: Stripe.Subscription[]) {
  if (!subscriptions.length) {
    return null;
  }

  return [...subscriptions].sort((a, b) => {
    const rankDelta = statusRank(b.status) - statusRank(a.status);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    return b.created - a.created;
  })[0];
}

export interface BillingSyncResult {
  synced: boolean;
  plan: "free" | "pro_monthly";
  status: string;
  source: "subscription_id" | "checkout_session" | "customer_lookup" | "none";
}

async function upsertFromSubscription(args: {
  userId: string;
  checkoutSessionId: string | null;
  fallbackCustomerId: string | null;
  source: BillingSyncResult["source"];
  subscription: Stripe.Subscription;
}): Promise<BillingSyncResult> {
  const stripeCustomerId =
    typeof args.subscription.customer === "string" ? args.subscription.customer : args.fallbackCustomerId;
  const plan = planFromSubscription(args.subscription);

  await upsertSubscription({
    userId: args.userId,
    plan,
    status: args.subscription.status,
    stripeCustomerId,
    stripeSubscriptionId: args.subscription.id,
    stripeCheckoutSessionId: args.checkoutSessionId,
    currentPeriodEnd: args.subscription.current_period_end
      ? new Date(args.subscription.current_period_end * 1000).toISOString()
      : null,
  });

  return {
    synced: true,
    plan,
    status: args.subscription.status,
    source: args.source,
  };
}

export async function syncBillingForUser(userId: string): Promise<BillingSyncResult> {
  const supabase = createAdminSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("plan, status, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load subscription state: ${existingError.message}`);
  }

  const existingPlan = existing?.plan === "pro_monthly" ? "pro_monthly" : "free";
  const existingStatus = existing?.status ?? "inactive";
  const checkoutSessionId = existing?.stripe_checkout_session_id ?? null;
  const customerId = existing?.stripe_customer_id ?? null;

  if (existing?.stripe_subscription_id) {
    const subscription = await stripe.subscriptions.retrieve(existing.stripe_subscription_id);
    return upsertFromSubscription({
      userId,
      checkoutSessionId,
      fallbackCustomerId: customerId,
      source: "subscription_id",
      subscription,
    });
  }

  if (checkoutSessionId) {
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);

    if (typeof session.subscription === "string") {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      return upsertFromSubscription({
        userId,
        checkoutSessionId,
        fallbackCustomerId: typeof session.customer === "string" ? session.customer : customerId,
        source: "checkout_session",
        subscription,
      });
    }
  }

  if (customerId) {
    const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
    const candidate = chooseBestSubscription(list.data);

    if (candidate && ACTIVE_STATUSES.has(candidate.status)) {
      return upsertFromSubscription({
        userId,
        checkoutSessionId,
        fallbackCustomerId: customerId,
        source: "customer_lookup",
        subscription: candidate,
      });
    }
  }

  return {
    synced: false,
    plan: existingPlan,
    status: existingStatus,
    source: "none",
  };
}
