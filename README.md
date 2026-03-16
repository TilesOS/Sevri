# Sevri MVP

Sevri is a production-minded SaaS scaffold for helping students pick, scope, execute, and package one authentic software project.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Supabase Postgres + Auth + RLS
- Stripe Checkout + webhook sync
- OpenAI structured JSON generation + Zod validation
- Resend email abstraction
- Sentry placeholder instrumentation
- Netlify deployment target

## Quick start

1. Copy `.env.example` to `.env.local` and fill all required values.
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. Apply Supabase migration: `supabase db push` (or run SQL manually)
5. Configure Stripe webhook to `POST /api/billing/webhook`

Do not set `NODE_ENV` in `.env.local` or in Netlify environment variables for this app. Let Next.js manage it during builds and runtime.

## Core flows

- Auth: `/sign-up` -> `/dashboard`
- Onboarding wizard: `/onboarding`
- Recommendations: `/recommendations`
- Project workspace: `/project/[id]`
- Billing: `/billing`

## Notes

- AI route handlers are server-only and validate model output with Zod before persistence.
- Free plan limits are defined in `src/lib/usage/limits.ts`.
- RLS policies are in `supabase/migrations/0001_init.sql`.
- Replace placeholder domains/emails before production launch.
