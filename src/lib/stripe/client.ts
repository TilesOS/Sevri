import Stripe from "stripe";
import { getServerEnv } from "@/lib/env";

const env = getServerEnv();

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  typescript: true,
});