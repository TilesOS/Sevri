import type Stripe from "stripe";
import { getStripeEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe/client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  getSubscriptionIdFromInvoice,
  getSubscriptionPeriodEndIso,
  planFromSubscription,
} from "@/lib/stripe/subscription-mapping";
import { upsertSubscription } from "@/lib/db/mutations/subscriptions";
import { trackEvent } from "@/lib/analytics/track";

async function lookupUserByStripeCustomer(customerId: string) {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.user_id ?? null;
}

async function lookupUserByStripeSubscription(subscriptionId: string) {
  const supabase = createAdminSupabaseClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  return data?.user_id ?? null;
}

async function resolveUserIdFromSubscription(subscription: Stripe.Subscription) {
  const metadataUserId = subscription.metadata.user_id;
  if (metadataUserId) {
    return metadataUserId;
  }

  const bySubscriptionId = await lookupUserByStripeSubscription(subscription.id);
  if (bySubscriptionId) {
    return bySubscriptionId;
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

  return stripe.webhooks.constructEvent(body, signature, getStripeEnv().STRIPE_WEBHOOK_SECRET);
}

async function upsertFromSubscription(subscription: Stripe.Subscription, userId: string, isDeleted = false) {
  await upsertSubscription({
    userId,
    plan: isDeleted ? "free" : planFromSubscription(subscription),
    status: subscription.status,
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : undefined,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: getSubscriptionPeriodEndIso(subscription),
  });
}

async function upsertFromCheckoutSession(session: Stripe.Checkout.Session, userId: string) {
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : undefined;
  const stripeSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;

  if (stripeSubscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    await upsertSubscription({
      userId,
      plan: planFromSubscription(subscription),
      status: subscription.status,
      stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      stripeCheckoutSessionId: session.id,
      currentPeriodEnd: getSubscriptionPeriodEndIso(subscription),
    });

    return;
  }

  await upsertSubscription({
    userId,
    plan: "free",
    status: "checkout_completed",
    stripeCustomerId,
    stripeCheckoutSessionId: session.id,
    currentPeriodEnd: null,
  });
}

/**
 * Renewals arrive as invoice events. `customer.subscription.updated` normally
 * covers them too, but handling invoices as well means a single missed event
 * type cannot leave a paying subscriber showing an elapsed period.
 */
async function handleInvoiceEvent(invoice: Stripe.Invoice) {
  const subscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!subscriptionId) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = await resolveUserIdFromSubscription(subscription);
  if (!userId) {
    return;
  }

  await upsertFromSubscription(subscription, userId);
}

export async function processStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;

      if (!userId) {
        return;
      }

      await upsertFromCheckoutSession(session, userId);
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

      await upsertFromSubscription(subscription, userId, event.type === "customer.subscription.deleted");
      return;
    }

    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      await handleInvoiceEvent(event.data.object as Stripe.Invoice);
      return;
    }

    default:
      return;
  }
}
