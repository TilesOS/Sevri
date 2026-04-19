import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
});

const aiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default("gpt-5.4-mini-2026-03-17"),
  OPENAI_FALLBACK_MODEL: z.string().default("gpt-5-mini-2025-08-07"),
  OPENAI_NORMALIZE_MODEL: z.string().optional(),
  OPENAI_STAGE1_MODEL: z.string().optional(),
  OPENAI_STAGE2_MODEL: z.string().optional(),
  OPENAI_STAGE3_MODEL: z.string().optional(),
});

const supabaseAdminEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const stripeEnvSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_PRO_MONTHLY: z.string().min(1),
});

const emailEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
});

const sentryEnvSchema = z.object({
  SENTRY_DSN: z.string().optional(),
});

const githubEnvSchema = z.object({
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_REDIRECT_URI: z.string().url(),
  INTEGRATIONS_ENCRYPTION_KEY: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes when base64-decoded",
    ),
});

export const clientEnv = clientEnvSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

let cachedAIEnv: z.infer<typeof aiEnvSchema> | null = null;
let cachedSupabaseAdminEnv: z.infer<typeof supabaseAdminEnvSchema> | null = null;
let cachedStripeEnv: z.infer<typeof stripeEnvSchema> | null = null;
let cachedEmailEnv: z.infer<typeof emailEnvSchema> | null = null;
let cachedSentryEnv: z.infer<typeof sentryEnvSchema> | null = null;
let cachedGithubEnv: z.infer<typeof githubEnvSchema> | null = null;

export function getAIEnv() {
  if (!cachedAIEnv) {
    cachedAIEnv = aiEnvSchema.parse(process.env);
  }

  return cachedAIEnv;
}

export function getSupabaseAdminEnv() {
  if (!cachedSupabaseAdminEnv) {
    cachedSupabaseAdminEnv = supabaseAdminEnvSchema.parse(process.env);
  }

  return cachedSupabaseAdminEnv;
}

export function getStripeEnv() {
  if (!cachedStripeEnv) {
    cachedStripeEnv = stripeEnvSchema.parse(process.env);
  }

  return cachedStripeEnv;
}

export function getEmailEnv() {
  if (!cachedEmailEnv) {
    cachedEmailEnv = emailEnvSchema.parse(process.env);
  }

  return cachedEmailEnv;
}

export function getSentryEnv() {
  if (!cachedSentryEnv) {
    cachedSentryEnv = sentryEnvSchema.parse(process.env);
  }

  return cachedSentryEnv;
}

export function getGithubEnv() {
  if (!cachedGithubEnv) {
    cachedGithubEnv = githubEnvSchema.parse(process.env);
  }

  return cachedGithubEnv;
}
