# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript type check (no emit)
```

Apply Supabase migrations: `supabase db push`

There are no automated tests. Type-check and lint are the verification tools.

## Environment

Copy `.env.example` to `.env.local`. Do NOT set `NODE_ENV` manually — let Next.js manage it.

Required env vars are validated at startup via Zod in `src/lib/env.ts`. Server-only vars are accessed via `getServerEnv()` (lazy-parsed, cached). Client vars are in `clientEnv` (parsed at module load). Adding a new env var requires updating both the schema and the call site.

Per-stage OpenAI model overrides: `OPENAI_STAGE1_MODEL`, `OPENAI_STAGE2_MODEL`, `OPENAI_STAGE3_MODEL`. Falls back to `OPENAI_MODEL` (default: `gpt-4.1-mini`).

## Architecture

### Route groups

- `(marketing)` — public pages (landing, pricing, terms, privacy)
- `(auth)` — sign-in, sign-up
- `(app)` — authenticated pages: dashboard, onboarding, recommendations, `/project/[id]`, billing, settings

### Core user flow

1. Sign up → onboarding wizard collects an intake
2. Intake is AI-normalized into a `GenerationContext` (stored in `normalized_profiles`)
3. User requests recommendation batch → 3 project options generated and stored in `project_recommendations`
4. User selects an option → roadmap generated, stored in `projects` + `project_roadmaps`
5. User works through roadmap steps → step guidance generated per step

### AI generation pipeline (`src/lib/ai/`)

All AI calls go through `generateStructuredOutput` in `client.ts`, which uses the **OpenAI Responses API** (`openai.responses.parse`). It:
- Enforces Zod schemas via `zodTextFormat`
- Retries with repair feedback on validation failures
- Tries fallback models if the primary fails
- Returns `GenerationMetrics` on every call

Three pipeline stages in `pipelines.ts`:
- `runOptionsGeneration` — generates 3 project options
- `runRoadmapGeneration` — generates full roadmap for a selected option
- `runStepGuidanceGeneration` — generates guidance for a single roadmap step

Each stage has deterministic fallbacks that run if the AI call fails entirely. Web search is conditionally enabled per-request based on recency/source-seeking signals detected in the prompt content.

Schemas live in `schemas.ts` (Zod + exported TypeScript types). Prompts in `prompts.ts`. `generation-context.ts` has helper utilities for deriving context metadata.

### Database (`supabase/migrations/0001_init.sql`)

Tables: `profiles`, `intakes`, `normalized_profiles`, `project_recommendations`, `projects`, `project_roadmaps`, `milestones`, `subscriptions`, `usage_events`

All tables have RLS enabled with user-scoped policies. `project_roadmaps` and `milestones` use indirect RLS via `projects`.

DB access pattern: `src/lib/db/queries/` for reads, `src/lib/db/mutations/` for writes. Always use `createServerSupabaseClient()` (server) or `createAdminSupabaseClient()` (service role, rate limiting, webhook).

### Auth

Middleware (`middleware.ts`) delegates to `updateSession` from `src/lib/supabase/middleware.ts` (Supabase SSR cookie refresh on every request).

In Server Components/Route Handlers, use `getRequiredUser()` (redirects to `/sign-in` if unauthenticated) or `getAuthenticatedUser()` (returns null) from `src/lib/auth/guard.ts`.

### Billing

Stripe Checkout + webhook sync. The webhook (`/api/billing/webhook`) syncs subscription status into the `subscriptions` table. Plan limits enforced via `src/lib/usage/limits.ts`:
- Free: 2 recommendation batches, no roadmap/readme/portfolio access
- Pro Monthly: 20 batches, full access

### Rate limiting

`enforceRateLimit` in `src/lib/usage/rate-limit.ts` counts `usage_events` rows within a time window. Uses service role client (bypasses RLS). Rate limit events are stored as `rate_limit:<endpoint>` event types.

### Path aliases

`@/` maps to `src/` (configured in `tsconfig.json`).
