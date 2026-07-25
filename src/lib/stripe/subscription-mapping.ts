import type Stripe from "stripe";
import { getStripeEnv } from "@/lib/env";

export function planFromSubscription(subscription: Stripe.Subscription): "free" | "pro_monthly" {
  const proPriceId = getStripeEnv().STRIPE_PRICE_PRO_MONTHLY;
  const activePriceIds = subscription.items.data.map((item) => item.price.id);

  return activePriceIds.includes(proPriceId) ? "pro_monthly" : "free";
}

function readUnixSeconds(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * The end of the paid-through period, as an ISO timestamp.
 *
 * Stripe moved `current_period_end` from the subscription onto its items in API
 * version 2025-03-31.basil. Webhook payloads are delivered in the version
 * configured on the endpoint, which can differ from the SDK's pinned version, so
 * read both shapes rather than silently writing null on the newer one.
 */
export function getSubscriptionPeriodEndIso(subscription: Stripe.Subscription): string | null {
  const direct = readUnixSeconds((subscription as unknown as Record<string, unknown>).current_period_end);
  if (direct !== null) {
    return new Date(direct * 1000).toISOString();
  }

  let latestItemEnd: number | null = null;
  for (const item of subscription.items?.data ?? []) {
    const itemEnd = readUnixSeconds((item as unknown as Record<string, unknown>).current_period_end);
    if (itemEnd !== null && (latestItemEnd === null || itemEnd > latestItemEnd)) {
      latestItemEnd = itemEnd;
    }
  }

  return latestItemEnd === null ? null : new Date(latestItemEnd * 1000).toISOString();
}

function readIdOrString(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (value && typeof value === "object") {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) {
      return id;
    }
  }

  return null;
}

/**
 * Renewal invoices are how a period advance is observed. `invoice.subscription`
 * moved under `invoice.parent.subscription_details` in 2025-03-31.basil, so both
 * shapes are checked here for the same reason as above.
 */
export function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const record = invoice as unknown as Record<string, unknown>;

  const direct = readIdOrString(record.subscription);
  if (direct) {
    return direct;
  }

  const parent = record.parent as { subscription_details?: { subscription?: unknown } } | null | undefined;
  return readIdOrString(parent?.subscription_details?.subscription);
}
