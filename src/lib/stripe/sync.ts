import Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hasVerifiedPlanAccess, isEntitledSubscriptionStatus } from "@/lib/billing/entitlements";
import {
  getSubscriptionPeriodEndIso,
  planFromSubscription,
} from "@/lib/stripe/subscription-mapping";
import { upsertSubscription } from "@/lib/db/mutations/subscriptions";

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
  entitled: boolean;
  currentPeriodEnd: string | null;
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
  const currentPeriodEnd = getSubscriptionPeriodEndIso(args.subscription);

  await upsertSubscription({
    userId: args.userId,
    plan,
    status: args.subscription.status,
    stripeCustomerId,
    stripeSubscriptionId: args.subscription.id,
    stripeCheckoutSessionId: args.checkoutSessionId ?? undefined,
    currentPeriodEnd,
  });

  return {
    synced: true,
    plan,
    status: args.subscription.status,
    entitled: hasVerifiedPlanAccess(plan, args.subscription.status),
    currentPeriodEnd,
    source: args.source,
  };
}

async function retrieveCheckoutSession(checkoutSessionId: string) {
  try {
    return await stripe.checkout.sessions.retrieve(checkoutSessionId);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return null;
    }

    throw error;
  }
}

function doesCheckoutSessionBelongToUser(args: {
  userId: string;
  storedCheckoutSessionId: string | null;
  customerId: string | null;
  session: Stripe.Checkout.Session;
}) {
  if (args.session.metadata?.user_id) {
    return args.session.metadata.user_id === args.userId;
  }

  if (args.storedCheckoutSessionId && args.session.id === args.storedCheckoutSessionId) {
    return true;
  }

  return typeof args.session.customer === "string" && Boolean(args.customerId) && args.session.customer === args.customerId;
}

export async function syncBillingForUser(
  userId: string,
  options: {
    checkoutSessionId?: string | null;
  } = {},
): Promise<BillingSyncResult> {
  const supabase = createAdminSupabaseClient();

  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, stripe_customer_id, stripe_subscription_id, stripe_checkout_session_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load subscription state: ${existingError.message}`);
  }

  const existingPlan = existing?.plan === "pro_monthly" ? "pro_monthly" : "free";
  const existingStatus = existing?.status ?? "inactive";
  const storedCheckoutSessionId = existing?.stripe_checkout_session_id ?? null;
  const customerId = existing?.stripe_customer_id ?? null;
  let checkoutSessionId = storedCheckoutSessionId;
  let verifiedCheckoutSession: Stripe.Checkout.Session | null = null;

  if (options.checkoutSessionId) {
    const session = await retrieveCheckoutSession(options.checkoutSessionId);

    if (session && doesCheckoutSessionBelongToUser({ userId, storedCheckoutSessionId, customerId, session })) {
      verifiedCheckoutSession = session;
      checkoutSessionId = session.id;

      if (typeof session.subscription === "string") {
        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        return upsertFromSubscription({
          userId,
          checkoutSessionId: session.id,
          fallbackCustomerId: typeof session.customer === "string" ? session.customer : customerId,
          source: "checkout_session",
          subscription,
        });
      }
    }
  }

  if (existing?.stripe_subscription_id) {
    const subscription = await stripe.subscriptions.retrieve(existing.stripe_subscription_id);
    return upsertFromSubscription({
      userId,
      checkoutSessionId: storedCheckoutSessionId,
      fallbackCustomerId: customerId,
      source: "subscription_id",
      subscription,
    });
  }

  if (checkoutSessionId) {
    const session =
      verifiedCheckoutSession?.id === checkoutSessionId ? verifiedCheckoutSession : await retrieveCheckoutSession(checkoutSessionId);

    if (session && typeof session.subscription === "string") {
      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      return upsertFromSubscription({
        userId,
        checkoutSessionId: session.id,
        fallbackCustomerId: typeof session.customer === "string" ? session.customer : customerId,
        source: "checkout_session",
        subscription,
      });
    }
  }

  if (customerId) {
    const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
    const candidate = chooseBestSubscription(list.data);

    if (candidate && isEntitledSubscriptionStatus(candidate.status)) {
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
    entitled: hasVerifiedPlanAccess(existingPlan, existingStatus),
    currentPeriodEnd: existing?.current_period_end ?? null,
    source: "none",
  };
}
