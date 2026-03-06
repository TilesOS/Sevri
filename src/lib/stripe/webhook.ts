import type Stripe from "stripe";
import { getServerEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe/client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { upsertSubscription } from "@/lib/db/mutations/subscriptions";
import { trackEvent } from "@/lib/analytics/events";

const env = getServerEnv();

function planFromSubscription(subscription: Stripe.Subscription): "free" | "pro_monthly" {
  const activePriceIds = subscription.items.data.map((item) => item.price.id);
  if (activePriceIds.includes(env.STRIPE_PRICE_PRO_MONTHLY)) {
    return "pro_monthly";
  }

  return "free";
}

async function lookupUserByStripeCustomer(customerId: string) {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.user_id ?? null;
}

async function resolveUserIdFromSubscription(subscription: Stripe.Subscription) {
  const metadataUserId = subscription.metadata.user_id;
  if (metadataUserId) {
    return metadataUserId;
  }

  if (typeof subscription.customer === "string") {
    return lookupUserByStripeCustomer(subscription.customer);
  }

  return null;
}

export function constructStripeEvent(body: string, signature: string | null) {
  if (!signature) {
    throw new Error("Missing Stripe signature header");
  }

  return stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
}

export async function processStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;

      if (!userId) {
        return;
      }

      await upsertSubscription({
        userId,
        plan: "free",
        status: "checkout_completed",
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeCheckoutSessionId: session.id,
      });

      await trackEvent(userId, "checkout_completed", { session_id: session.id });
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = await resolveUserIdFromSubscription(subscription);

      if (!userId) {
        return;
      }

      const isDeleted = event.type === "customer.subscription.deleted";
      await upsertSubscription({
        userId,
        plan: isDeleted ? "free" : planFromSubscription(subscription),
        status: subscription.status,
        stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : null,
        stripeSubscriptionId: subscription.id,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      });

      return;
    }

    default:
      return;
  }
}