import Stripe from "stripe";
import { getStripeEnv } from "@/lib/env";

const env = getStripeEnv();

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  typescript: true,
});
