import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getStripeEnv, clientEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe/client";
import { upsertSubscription } from "@/lib/db/mutations/subscriptions";

export async function createCheckoutSession(userId: string, email?: string | null) {
  const env = getStripeEnv();
  const supabase = createAdminSupabaseClient();

  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  let customerId = existingSubscription?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { user_id: userId },
    });

    customerId = customer.id;
  }

  const successUrl = `${clientEnv.NEXT_PUBLIC_SITE_URL}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${clientEnv.NEXT_PUBLIC_SITE_URL}/billing?checkout=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: env.STRIPE_PRICE_PRO_MONTHLY, quantity: 1 }],
    metadata: {
      user_id: userId,
    },
    subscription_data: {
      metadata: {
        user_id: userId,
      },
    },
    allow_promotion_codes: true,
  });

  await upsertSubscription({
    userId,
    plan: "free",
    status: "checkout_pending",
    stripeCustomerId: customerId,
    stripeCheckoutSessionId: session.id,
  });

  return session;
}

export async function createPortalSession(userId: string) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  if (error || !data.stripe_customer_id) {
    throw new Error("No Stripe customer found for user");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${clientEnv.NEXT_PUBLIC_SITE_URL}/billing`,
  });

  return session;
}
