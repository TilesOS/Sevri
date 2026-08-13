# Sevri MVP

Sevri is a student project-to-portfolio coach for any field. It helps students compare three meaningful directions, choose one, finish it with a realistic roadmap, and package the result as evidence.

## Stack

- Next.js App Router + TypeScript + Tailwind
- Supabase Postgres + Auth + RLS
- Stripe Checkout + webhook sync
- OpenAI structured JSON generation + Zod validation
- Resend email abstraction
- Privacy-scrubbed Sentry error monitoring
- Vercel deployment target

## Quick start

1. Copy `.env.example` to `.env.local` and fill all required values.
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`
4. Apply Supabase migration: `supabase db push` (or run SQL manually)
5. Configure Stripe webhook to `POST /api/billing/webhook`

Do not set `NODE_ENV` in `.env.local` or in Vercel environment variables for this app. Let Next.js manage it during builds and runtime.

## Verification

- `npm run lint` checks the whole repository.
- `npm run typecheck` is the full strict check for application code, tests, and scripts.
- `npm run typecheck:build` uses the narrower production Next.js config.
- `npm run test:unit` runs the unit suite.
- After `npm run build`, `npm run build:report` prints phase spans, the slowest
  traced modules, the largest client/server bundles, and the local webpack
  cache size.

## Sentry

Set `NEXT_PUBLIC_SENTRY_DSN` for browser reporting and `SENTRY_DSN` for the
server and edge runtimes. The server safely falls back to the public DSN.
Events retain stack locations and fixed operational labels, while request
data, user data, identifiers, messages, source context, and arbitrary extras
are removed before sending. Performance tracing and replay are disabled.

Source-map upload is intentionally not configured. Enable it only after
provisioning `SENTRY_AUTH_TOKEN`, organization/project identifiers, and an
operational need that justifies the extra build work.

For a controlled end-to-end check, set `SENTRY_TEST_ROUTE_ENABLED=true` and a
high-entropy `SENTRY_TEST_ROUTE_TOKEN`, deploy, then send:

```bash
curl -X POST https://your-host.example/api/monitoring/sentry-test \
  -H "x-sentry-test-token: $SENTRY_TEST_ROUTE_TOKEN"
```

Disable the route again after confirming the returned event ID in Sentry.

## Core flows

- Auth: `/sign-up` -> `/dashboard`
- Onboarding wizard: `/onboarding`
- Recommendations: `/recommendations`
- Project workspace: `/project/[id]`
- Billing: `/settings/billing`

## Notes

- AI route handlers are server-only and validate model output with Zod before persistence.
- Free plan limits are defined in `src/lib/usage/limits.ts`.
- RLS policies are in `supabase/migrations/0001_init.sql`.
- Replace placeholder domains/emails before production launch.
