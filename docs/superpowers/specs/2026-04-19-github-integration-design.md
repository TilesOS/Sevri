# GitHub Integration

**Date:** 2026-04-19
**Status:** Draft — pending review

## Overview

Pro students on software-track projects can connect their GitHub account via OAuth and link one public repository per project. Once linked, Sevri shows the last 100 commits on the project Overview, attributes each commit to a milestone by time window, enables an "Import from GitHub" action on the milestone submission form that pre-fills the textarea with recent commit titles and bodies, and surfaces a line-diff between the repo's README and the AI-generated `readme_draft` on the Presentation page.

v1 is intentionally narrow. Scope is **public repositories only**, read-only access (`public_repo, read:user`), **one repo per project**, **no webhooks**, **software-track only**, **Pro-gated** at the link step. Commit-to-milestone attribution is purely time-window based — commit messages are never parsed for milestone tags or references. Freshness is maintained by a 5-minute server-side cache stored on the link row itself. Writes of any kind back to GitHub (commits, PRs, file edits) and surfacing of Issues, Pull Requests, or Actions are explicit anti-goals.

Free users can still complete the OAuth handshake so the upgrade prompt lands in context; the Pro gate is enforced only at `POST /api/projects/[id]/github/link`.

---

## Section 1: Database

Migration: `supabase/migrations/0010_github_integration.sql` — to be written and applied manually by Tyler.

### `user_integrations`

One row per `(user_id, provider)`. Holds encrypted OAuth tokens and provider identity. The table is forward-compatible with additional providers (Google, GitLab, etc.) by widening the `provider` check constraint in a future migration.

```sql
create table public.user_integrations (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  provider                text not null check (provider in ('github')),
  access_token_encrypted  bytea not null,
  refresh_token_encrypted bytea,
  token_expires_at        timestamptz,
  scopes                  text[] not null default '{}',
  provider_user_id        text not null,
  provider_username       text not null,
  status                  text not null default 'active'
                          check (status in ('active','revoked','invalid')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger trg_user_integrations_updated_at
before update on public.user_integrations
for each row execute function public.set_updated_at();
```

- `access_token_encrypted` and `refresh_token_encrypted` are `bytea`. Raw tokens never hit disk. Encryption format is documented in Section 2.
- `token_expires_at` is nullable. GitHub OAuth App tokens do not expire by default; the column is retained for future providers that issue short-lived tokens.
- `scopes` is a `text[]` of the scope strings granted by the provider (e.g. `{public_repo,read:user}`). Stored so the server can verify requested scopes are still present before making calls.
- `provider_user_id` is the provider-side stable ID (GitHub returns a numeric user ID). `provider_username` is the display handle (`octocat`). Both are stored so the UI can render the connected account without an extra API call on every page.
- `status`:
  - `'active'` — normal.
  - `'invalid'` — GitHub returned 401 on a recent call. UI prompts the user to reconnect. We do **not** attempt silent refresh.
  - `'revoked'` — reserved for future explicit revocation flows; unused in v1.

Indexes: the `unique (user_id, provider)` compound index is sufficient — `user_id` is always the leading predicate on lookup.

RLS:

```sql
alter table public.user_integrations enable row level security;

create policy p_user_integrations_own on public.user_integrations for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

- Direct ownership, mirrors `p_profiles_own` in `0001_init.sql`.
- Decryption happens only in server-side integration client code (Section 3) — tokens are never selected by client-side Supabase queries. RLS is a belt-and-suspenders layer; the real protection is that no route handler returns the encrypted bytes.

### `project_github_links`

One row per project. Holds the linked repo's identity, the 5-minute cache payload, and the repo's health status.

```sql
create table public.project_github_links (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null unique references public.projects(id) on delete cascade,
  repo_full_name text not null,
  default_branch text not null,
  readme_sha     text,
  cached_commits jsonb,
  cached_readme  text,
  last_synced_at timestamptz,
  status         text not null default 'active'
                 check (status in ('active','broken')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_project_github_links_updated_at
before update on public.project_github_links
for each row execute function public.set_updated_at();
```

- `project_id` is declared `unique` — this is the DB-level enforcement of "one repo per project." The link mutation is an UPSERT keyed on `project_id`, so re-linking a project overwrites the prior row (UI handles the confirm dialog).
- `repo_full_name` stores the canonical GitHub slug in `owner/name` form. No length constraint beyond the Postgres default — GitHub's own limits keep it well under 200 chars.
- `cached_commits` is the 5-minute commit cache as `jsonb`. Shape: an array of `{ sha, short_sha, message, message_title, message_body, author: { name, date, avatar_url }, html_url }`. Trimmed to at most 100 commits on the default branch. Null when the row is first created — populated on the first activity fetch.
- `cached_readme` is the raw README markdown returned by `GET /repos/{owner}/{name}/readme` (after base64-decoding the `content` field). `readme_sha` is the matching blob SHA; the pair is refreshed together. Both null before the first fetch.
- `last_synced_at` drives cache freshness. If `now() - last_synced_at < 5 minutes`, the activity endpoint returns cached data without hitting GitHub.
- `status`:
  - `'active'` — normal.
  - `'broken'` — repo went private, was deleted, or renamed (any 403/404 on the activity fetch). UI prompts re-link or unlink. No automatic recovery.

Indexes: the `unique (project_id)` constraint is sufficient. Lookup is always by `project_id`; there is no cross-project scan.

RLS:

```sql
alter table public.project_github_links enable row level security;

create policy p_project_github_links_via_project on public.project_github_links for all
using (
  exists (select 1 from public.projects p
          where p.id = project_id and p.user_id = auth.uid())
)
with check (
  exists (select 1 from public.projects p
          where p.id = project_id and p.user_id = auth.uid())
);
```

- Indirect ownership via `projects.user_id`, mirroring `p_roadmaps_via_project` in `0001_init.sql`.
- Reviewer visibility of GitHub data is explicitly **out of scope for v1** (see Section 11). A future migration will add `p_project_github_links_reviewer_select` mirroring the reviewer SELECT policies added in `0008_project_reviewer_role.sql`.

---

## Section 2: Encryption

pgsodium is **not** enabled in this Supabase project — only `pgcrypto`. No existing migration calls `create extension pgsodium` or any `pgsodium.crypto_*` function. Rather than introduce pgsodium (which requires Vault setup and doesn't ship on all Supabase project tiers), **v1 uses app-layer encryption** with Node's built-in `crypto` module.

### Algorithm

**AES-256-GCM** with a 256-bit key, 96-bit (12-byte) random IV per token, and 128-bit (16-byte) auth tag. The on-disk layout is a single `bytea` column:

```
[ iv (12 bytes) ][ ciphertext (variable) ][ auth tag (16 bytes) ]
```

### Key

`INTEGRATIONS_ENCRYPTION_KEY` (Section 3) is a 32-byte value provided as a base64 string in the environment. A startup-time Zod refinement verifies the decoded length is exactly 32 bytes; any other length throws at first read.

Key rotation is deferred to v2 — rotating would require re-encrypting every `user_integrations` row, which needs a deliberate migration script rather than a hot path. The spec explicitly does not address rotation.

### Module

`src/lib/integrations/github/encryption.ts` (new). Exports:

```typescript
export function encryptToken(plaintext: string): Buffer;
export function decryptToken(ciphertext: Buffer): string;
```

Both are synchronous. `encryptToken` generates a fresh IV via `crypto.randomBytes(12)` per call, so the same plaintext never produces the same ciphertext twice. `decryptToken` throws on auth-tag mismatch, which happens cleanly because GCM is AEAD.

### Verification

Because there is no automated test suite in this repo, Stage 1 of the implementation adds `scripts/verify-encryption.ts` — a small Node script that:

1. Reads `INTEGRATIONS_ENCRYPTION_KEY` from the environment.
2. Encrypts a known fixture (`"ghp_testing_fixture_1234567890"`), decrypts it, asserts equality.
3. Encrypts the same plaintext twice, asserts the two ciphertexts differ (IV freshness).
4. Tampers with one byte of ciphertext, asserts `decryptToken` throws.

Run manually before committing Stage 1.

### What is never logged

- Raw tokens (plaintext).
- Decrypted tokens returned from `decryptToken`.
- The contents of `INTEGRATIONS_ENCRYPTION_KEY`.
- The `access_token_encrypted` or `refresh_token_encrypted` bytea values (e.g. in Sentry error context or server logs).

A Sentry scrubbing rule for the substring `access_token` is already in place for the Stripe flow and covers this code path transitively; no new rule is required, but the scrubbing list should be reviewed once in Stage 2.

---

## Section 3: Environment

Added to `src/lib/env.ts` as a new per-service lazy-parsed schema, matching the existing `stripeEnvSchema` / `getStripeEnv()` pattern.

```typescript
const githubEnvSchema = z.object({
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_REDIRECT_URI: z.string().url(),
  INTEGRATIONS_ENCRYPTION_KEY: z
    .string()
    .refine(
      (v) => Buffer.from(v, "base64").length === 32,
      "INTEGRATIONS_ENCRYPTION_KEY must be 32 bytes when base64-decoded"
    ),
});

let cachedGithubEnv: z.infer<typeof githubEnvSchema> | null = null;

export function getGithubEnv() {
  if (!cachedGithubEnv) {
    cachedGithubEnv = githubEnvSchema.parse(process.env);
  }
  return cachedGithubEnv;
}
```

- All four vars are **server-only**. None are prefixed `NEXT_PUBLIC_`. Client code that needs to initiate the connect flow hits `GET /api/integrations/github/authorize`, which redirects; the client never sees the client ID or the redirect URI directly.
- `GITHUB_REDIRECT_URI` must exactly match the value configured on the GitHub OAuth App (e.g. `https://sevri.co/api/integrations/github/callback` in production, `http://localhost:3000/api/integrations/github/callback` in development). Mismatch causes GitHub to reject the exchange with a 400.
- `.env.example` is updated with all four vars and a comment pointing at the GitHub OAuth App configuration panel.

---

## Section 4: Library Modules

All new code lives under `src/lib/integrations/github/`. Importing from this directory is restricted to server-only contexts (route handlers, server components, mutations).

### `encryption.ts`

See Section 2.

### `oauth.ts`

Handles the OAuth 2.0 authorization-code flow.

```typescript
export const STATE_COOKIE_NAME = "__Host-gh_oauth_state";

export function createStateCookieOptions(): ResponseCookieOptions;
// httpOnly, SameSite=Lax, Secure in production, Path=/, Max-Age=600

export function buildAuthorizeUrl(state: string): string;
// https://github.com/login/oauth/authorize?client_id=...&redirect_uri=...&scope=public_repo+read:user&state=...

export async function exchangeCodeForToken(code: string): Promise<{
  access_token: string;
  scope: string;
  token_type: "bearer";
}>;
// POSTs to https://github.com/login/oauth/access_token with Accept: application/json

// Documented no-op — GitHub OAuth App tokens don't expire by default.
// Kept as a typed stub so the call site signature is stable if we ever migrate to a GitHub App.
export async function refreshToken(): Promise<never>;
```

- The `scope` string is split on spaces and stored in `user_integrations.scopes` as a `text[]`.
- State is 32 bytes from `crypto.randomBytes(32)`, base64url-encoded — 43 chars, ≥256 bits of entropy. Not signed; stored opaquely in the cookie and compared byte-for-byte in the callback. The cookie itself is httpOnly / SameSite=Lax / Secure / 10-minute TTL — if an attacker cannot read or set the cookie, the state value is sufficient.

### `client.ts`

Narrow GitHub REST client. The client is deliberately scoped — it exposes only the four operations this feature needs, and no escape hatch to make arbitrary GitHub calls.

```typescript
export async function createGitHubClient(userId: string): Promise<GitHubClient>;

interface GitHubClient {
  getUser(): Promise<{ id: number; login: string; avatar_url: string }>;
  getRepo(fullName: string): Promise<{
    full_name: string;
    default_branch: string;
    private: boolean;
    html_url: string;
  }>;
  listCommits(
    fullName: string,
    opts?: { since?: string; until?: string; perPage?: number }
  ): Promise<GitHubCommit[]>;
  getReadme(fullName: string): Promise<{ content: string; sha: string }>;
}
```

- `createGitHubClient` loads the `user_integrations` row for `userId`, decrypts the access token, and returns a closure that embeds the token in an `Authorization: Bearer` header. The token never leaves the closure — callers cannot read it.
- If the integration is missing or `status !== 'active'` → throws `GitHubNotConnectedError`.
- HTTP layer uses `fetch` with explicit `Accept: application/vnd.github+json` and `X-GitHub-Api-Version: 2022-11-28` headers.
- Error mapping:
  - 401 → `GitHubTokenRevokedError`, caller updates `user_integrations.status = 'invalid'`.
  - 403 with `X-RateLimit-Remaining: 0` → `GitHubRateLimitedError` (external GitHub limit, distinct from our internal `enforceRateLimit`).
  - 403/404 on a repo → `GitHubRepoNotFoundError`, caller updates `project_github_links.status = 'broken'`.
  - `getRepo` returning `{ private: true }` → caller raises `GitHubPrivateRepoError` before storing anything.
- `listCommits` caps `perPage` at 100. Defaults to 30. Only the default branch is queried (`?sha=<default_branch>`).
- `getReadme` returns the already-base64-decoded markdown. GitHub's `/readme` endpoint returns base64-encoded `content`.

### `attribution.ts`

Pure function, no IO. Assigns each commit to exactly one milestone bucket.

```typescript
export function attributeCommitsToMilestones(
  commits: GitHubCommit[],
  milestones: Milestone[],            // ordered by order_index asc
  projectStartedAt: string            // projects.selected_at ISO string
): {
  attribution: Record<string, string[]>;  // milestoneId -> commit SHAs
  unattributed: string[];                 // commit SHAs outside all windows
}
```

**Algorithm** (also documented in the Overview of the feature page):

> Milestones are ordered by `order_index` ascending. For each milestone `M[i]`:
>
> - **window start** = `max( M[i-1].completed_at if exists, projectStartedAt )`
> - **window end** = `M[i].completed_at if completed, else now()`
>
> A commit with `author.date` in the half-open interval `[start, end)` is attributed to `M[i]`.
> Each commit is attributed to exactly one milestone — the earliest bucket whose window contains it.
> Commits outside every window (e.g., authored before `projectStartedAt`) appear in the raw activity list but are absent from the attribution map.

This is intentionally predictable rather than clever. Trade-offs accepted:

- If a student works on "milestone 3" while milestone 2 is still open, commits still attribute to milestone 2 by timestamp. The UI copy makes this explicit: "Commits authored while this step was active."
- Out-of-order milestone completion produces counter-intuitive but consistent buckets. Documented in the UI tooltip.
- Commit messages are **never** scanned for milestone references, `#3`, `step:`, or any tag convention. Tag-based attribution is brittle, hard to teach, and loads the student with formatting rules. Time windows are legible and automatic.

### `errors.ts`

```typescript
export class GitHubIntegrationError extends Error {}
export class GitHubNotConnectedError   extends GitHubIntegrationError {}
export class GitHubTokenRevokedError   extends GitHubIntegrationError {}
export class GitHubRateLimitedError    extends GitHubIntegrationError {}
export class GitHubRepoNotFoundError   extends GitHubIntegrationError {}
export class GitHubPrivateRepoError    extends GitHubIntegrationError {}
```

Route handlers narrow on these classes with `instanceof` to map to HTTP status codes (Section 5).

### `cache.ts`

Thin wrapper over the cache columns on `project_github_links`.

```typescript
export async function readCachedActivity(projectId: string): Promise<CachedPayload | null>;
export async function writeCachedActivity(projectId: string, payload: CachedPayload): Promise<void>;
export function isCacheFresh(lastSyncedAt: string | null): boolean; // < 5 min old
```

Cache invalidation is strictly time-based — 5 minutes since `last_synced_at`. Unlink writes do not explicitly clear the cache; the row is deleted by `on delete cascade` when the link is removed.

### `src/lib/db/queries/github.ts` and `src/lib/db/mutations/github.ts`

Standard query/mutation files, following the split convention already used for `projects`, `reviewers`, etc.

```typescript
// queries/github.ts
export async function getUserIntegration(userId: string, provider: "github"): Promise<UserIntegrationRow | null>;
export async function getProjectGithubLink(projectId: string): Promise<ProjectGithubLinkRow | null>;

// mutations/github.ts
export async function upsertUserIntegration(input: UpsertIntegrationInput): Promise<UserIntegrationRow>;
export async function markIntegrationInvalid(userId: string, provider: "github"): Promise<void>;
export async function deleteUserIntegration(userId: string, provider: "github"): Promise<void>;
export async function upsertProjectGithubLink(input: UpsertLinkInput): Promise<ProjectGithubLinkRow>;
export async function markLinkBroken(projectId: string): Promise<void>;
export async function deleteProjectGithubLink(projectId: string): Promise<void>;
export async function writeLinkCache(projectId: string, cache: CachePayload): Promise<void>;
```

Query functions use the server Supabase client (RLS enforced). The two writers that need to operate outside the user's session — specifically `markIntegrationInvalid` and `markLinkBroken`, which are called from route handlers after a failed GitHub call — use the admin client because they must succeed even if the user's session is intermittently unavailable. Both functions still scope their write by `user_id` / `project_id` passed in from the calling handler, which is derived from the authenticated user context.

---

## Section 5: API Routes

All route handlers live under `src/app/api/`. Every route calls `requireApiStudent()` from `src/lib/auth/api.ts` — GitHub is a student feature; reviewers do not connect or link repos.

### `GET /api/integrations/github/authorize`

Initiates the OAuth handshake. 302s the browser to GitHub's authorize URL.

**Sequence:**

1. `requireApiStudent()` → 401/403 on failure.
2. `state = crypto.randomBytes(32).toString("base64url")`.
3. Set response cookie `__Host-gh_oauth_state` with `createStateCookieOptions()` (httpOnly, SameSite=Lax, Secure in prod, Path=/, Max-Age=600).
4. Return `NextResponse.redirect(buildAuthorizeUrl(state), { status: 302 })`.

### `GET /api/integrations/github/callback`

Completes the handshake. Called by GitHub with `?code=...&state=...`.

**Sequence:**

1. `requireApiStudent()`.
2. Read `state` query param and `__Host-gh_oauth_state` cookie. If either missing or mismatched → redirect to `/settings/integrations?error=state_mismatch`. Clear the state cookie.
3. `exchangeCodeForToken(code)` → on failure, redirect to `/settings/integrations?error=code_exchange_failed`.
4. Instantiate a temporary client with the new token and call `getUser()` → on 401, redirect with `error=user_fetch_failed`.
5. `upsertUserIntegration({ user_id: user.id, provider: 'github', access_token_encrypted: encryptToken(token.access_token), scopes: token.scope.split(' '), provider_user_id: String(ghUser.id), provider_username: ghUser.login, status: 'active' })` keyed on `(user_id, provider)`.
6. Clear the state cookie.
7. Redirect to `/settings/integrations?connected=github`.

### `DELETE /api/integrations/github`

Disconnects GitHub for the current user. `project_github_links` rows the user owns are left in place — they will be orphaned (no token to sync), but the UI on the Overview card handles this by showing a "reconnect" state. This is simpler than cascade-deleting project links and lets users reconnect without losing their link configuration.

**Sequence:**

1. `requireApiStudent()`.
2. `deleteUserIntegration(user.id, 'github')`.
3. Return `200 { status: "disconnected" }`.

### `POST /api/projects/[id]/github/link`

Links a public repo to a project. Pro-gated.

**Request body:**

```typescript
export const linkGithubRepoSchema = z.object({
  repo_full_name: z.string().regex(/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/),
});
```

**Sequence:**

1. `requireApiStudent()`.
2. `assertFeatureAccess({ userId: user.id, feature: "link_github" })` → if `!allowed`, return `createUpgradeRequiredResponse(result.error)` (403, `{ code: "upgrade_required", feature: "link_github", upgrade_url: "/billing" }`).
3. Load project by `[id]`; verify `user_id === user.id` → `404` if not found.
4. Verify `project.project_track === "software"` → `400 { code: "wrong_track", message: "GitHub linking is only available on software-track projects." }`.
5. Load `user_integrations` for `(user.id, 'github')`. If missing or `status !== 'active'` → `409 { code: "not_connected", message: "Connect GitHub first." }`.
6. `createGitHubClient(user.id).getRepo(repo_full_name)`:
   - On `GitHubRepoNotFoundError` → `404 { code: "repo_not_found" }`.
   - On `GitHubTokenRevokedError` → `markIntegrationInvalid(user.id, 'github')`, return `409 { code: "token_revoked" }`.
   - If `repo.private === true` → `400 { code: "private_repo", message: "Sevri can only link public repos in v1. Make it public or wait for a future version." }`.
7. `upsertProjectGithubLink({ project_id: [id], repo_full_name, default_branch: repo.default_branch, status: 'active' })` keyed on `project_id`.
8. Return `201 { link: ProjectGithubLinkRow }` (no cache fields yet — those populate on the first activity fetch).

Re-linking a different repo to a project where one is already linked overwrites the existing row (same UPSERT). The UI is responsible for showing a confirm dialog before calling this endpoint with a different `repo_full_name`. The API is idempotent.

### `DELETE /api/projects/[id]/github/link`

**Sequence:**

1. `requireApiStudent()`.
2. Load project; verify ownership.
3. `deleteProjectGithubLink(project.id)`.
4. Return `200 { status: "unlinked" }`.

### `GET /api/projects/[id]/github/activity`

Returns commits, the commit→milestone attribution map, and the current README. Cache hit rate is the target — the endpoint is called on every Overview page load.

**Sequence:**

1. `requireApiStudent()`.
2. `enforceRateLimit({ userId: user.id, endpoint: "github_activity", maxRequests: 60, windowMinutes: 60 })` → `429` if hit.
3. Load project + milestones + `project_github_links`. Verify ownership. If no link → `404 { code: "not_linked" }`.
4. If `isCacheFresh(link.last_synced_at)`: compute attribution from `link.cached_commits` + milestones, return cached payload.
5. Else:
   1. `createGitHubClient(user.id)`.
   2. `listCommits(repo_full_name, { perPage: 100 })`:
      - `GitHubTokenRevokedError` → `markIntegrationInvalid`, return `409 { code: "token_revoked" }`.
      - `GitHubRepoNotFoundError` → `markLinkBroken(project.id)`, return `410 { code: "repo_broken" }`.
      - `GitHubRateLimitedError` → if `cached_commits` is not null, return the cached payload with a `stale: true` flag; otherwise return `503 { code: "github_rate_limited" }`.
   3. `getReadme(repo_full_name)` — same error handling. README failure alone does not fail the whole response; commits still render and `readme` returns `null`.
   4. `writeLinkCache(project.id, { cached_commits, cached_readme, readme_sha, last_synced_at: now() })`.
6. Compute attribution via `attributeCommitsToMilestones(commits, milestones, project.selected_at)`.
7. Return:

```typescript
{
  commits: GitHubCommit[],
  attribution: Record<string, string[]>,   // milestoneId -> commit SHAs
  readme: { content: string; sha: string } | null,
  last_synced_at: string,
  stale?: true,
}
```

### `GET /api/projects/[id]/github/submission-import?milestone_id=...`

Returns a formatted block of text that the client pastes into the submission textarea. **Does not create a submission.**

**Sequence:**

1. `requireApiStudent()`.
2. Verify project ownership + link present.
3. Fetch activity (uses cache if fresh — does not double-count rate limit).
4. Filter commits to those in the attribution map for `milestone_id`.
5. Format as:

```
<commit message title> (<short sha>)
<commit message body, if non-empty>

<next commit…>
```

6. Truncate to at most `MAX_SUBMISSION_CHARS` (20 000) — the same budget the textarea enforces. On truncation, append a trailing line: `"…truncated — see full history on GitHub."`
7. Return `200 { content: string, commit_count: number, truncated: boolean }`.

### HTTP error-code contract

| Scenario | Status | Body |
|---|---|---|
| Not signed in | 401 | `{ error: "Unauthorized" }` |
| Wrong role | 403 | `{ error: "Forbidden", code: "wrong_role" }` |
| Free plan hitting `link` | 403 | `UpgradeRequiredError` shape, `feature: "link_github"` |
| Project not owned by user | 404 | `{ error: "Not found" }` |
| Research-track project | 400 | `{ code: "wrong_track" }` |
| GitHub not connected | 409 | `{ code: "not_connected" }` |
| GitHub token revoked | 409 | `{ code: "token_revoked" }` |
| Private repo at link time | 400 | `{ code: "private_repo" }` |
| Repo not found / became private | 410 | `{ code: "repo_broken" }` |
| Internal rate limit | 429 | `{ code: "rate_limited", resetAt: ISO }` |
| GitHub rate limit (no cache) | 503 | `{ code: "github_rate_limited" }` |

---

## Section 6: Plan Gating

Gating is enforced at exactly one place: `POST /api/projects/[id]/github/link`. Free users may complete the OAuth handshake — the `user_integrations` row is created — but the first attempt to attach a repo to a project returns a 403 with the standard upgrade-required error shape. This keeps the upgrade prompt in the user's flow rather than hiding the feature entirely.

### `src/lib/usage/limits.ts`

Add `link_github` to `PLAN_LIMITS` and export a matching check.

```typescript
export const PLAN_LIMITS = {
  free:        { ...existing, link_github: false },
  pro_monthly: { ...existing, link_github: true  },
} as const;

export function canLinkGithub(plan: Plan): boolean {
  return PLAN_LIMITS[plan].link_github;
}
```

### `src/lib/usage/feature-access.ts`

Extend the `RestrictedFeature` union and wire the new feature into `assertFeatureAccess`.

```typescript
export type RestrictedFeature =
  | "step_guidance"
  | "invite_reviewer"
  | "link_github";
```

Inside `assertFeatureAccess`, the `link_github` branch returns the standard `UpgradeRequiredError`:

```typescript
{
  code: "upgrade_required",
  feature: "link_github",
  error: "Linking a GitHub repository requires Pro.",
  upgrade_url: "/billing",
}
```

### UI gating

The Overview card renders differently per plan:

| Plan | State | Rendering |
|---|---|---|
| free | any | Card shows "Linking a repo is a Pro feature" with an upgrade CTA. Connect button is still visible — connecting is free. |
| pro_monthly | connected, no link | Repo input + autocomplete. |
| pro_monthly | linked | Activity strip + unlink. |

This double-gates — UI + API. The API check is authoritative.

---

## Section 7: UI

All UI changes are scoped behind `workspace.projectTrack === "software"` — the same branching pattern used in `src/lib/projects/workspace.ts` for the research vs. software lens. Research projects see no GitHub surfaces.

### `/settings/integrations`

New page at `src/app/(app)/settings/integrations/page.tsx`. Mirrors the shell of `src/app/(app)/settings/page.tsx`.

Layout:

```
<PageHeader
  eyebrow="Integrations"
  title="Connect external services."
  description="Link Sevri to the tools you already use."
/>

<Card tone="primary">
  <div className="flex items-center justify-between">
    <div>
      <p className="editorial-kicker">GitHub</p>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        {connected
          ? `Connected as @${integration.provider_username}.`
          : "Link public repositories to your software projects."}
      </p>
    </div>
    {connected ? (
      <Button variant="outline" onClick={disconnect}>Disconnect</Button>
    ) : (
      <Button onClick={() => router.push("/api/integrations/github/authorize")}>
        Connect GitHub
      </Button>
    )}
  </div>
  {integration?.status === "invalid" && (
    <p className="mt-3 text-sm text-danger">
      Your GitHub connection was revoked. Reconnect to resume syncing.
    </p>
  )}
</Card>
```

A `?connected=github` query param shows a one-shot success toast. A `?error=...` query param surfaces a concise error copy per failure mode.

### `/settings` — link to integrations

A single additional `Card` added at the bottom of `src/app/(app)/settings/page.tsx`:

```
<Card>
  <p className="editorial-kicker">Integrations</p>
  <p className="mt-2 text-sm leading-6 text-ink-soft">
    Connect GitHub to sync commits and READMEs with your projects.
  </p>
  <Link className="mt-3 inline-flex…" href="/settings/integrations">Manage integrations →</Link>
</Card>
```

No sidebar / tab nav refactor. Deferred to a future pass when more integrations exist.

### Project Overview — GitHub card

`src/components/project/project-overview-view.tsx` — added as a new `<Card>` in the 3-column grid (lines 87–103), rendered only when `workspace.projectTrack === "software"`.

Three states:

| State | Condition | Rendering |
|---|---|---|
| _not connected_ | no `user_integrations.github` row | "Connect GitHub to track your commits." + primary button linking to `/settings/integrations`. |
| _connected, no link_ | integration present, no `project_github_links` row | Repo input with autocomplete populated by a client-side call to `GET /api/integrations/github/repos` (a thin passthrough to `GET /user/repos?visibility=public&sort=updated&per_page=20`). **Free users see an upgrade CTA here instead of the input.** |
| _linked, active_ | link row present, `status === 'active'` | Compact strip of the 10 most recent commits (short sha + message title + relative time + avatar), each linking to `html_url`. Last-synced timestamp. Unlink button (with confirm dialog). |
| _linked, broken_ | `status === 'broken'` | Amber banner: "Your linked repo is no longer reachable — it may have been deleted or made private." Buttons: re-link, unlink. |
| _linked, token invalid_ | integration `status === 'invalid'` | Amber banner: "Reconnect GitHub to resume syncing." Button to `/settings/integrations`. |

The commit strip is rendered from the activity endpoint response; the card component fetches on mount via a tiny SWR-less `useEffect`. If the response has `stale: true`, a small "showing last synced data" note appears under the strip.

### Per-milestone commit list

`src/components/project/project-step-workspace.tsx` — added inside the per-milestone panel (the existing step body), rendered only when `workspace.projectTrack === "software"` and `workspace.githubLink?.status === "active"`.

```
<Collapsible title="Commits attributed to this step">
  {attributedCommits.length === 0 ? (
    <p className="text-sm text-ink-soft">No commits authored while this step was active yet.</p>
  ) : (
    <ul>…commit rows…</ul>
  )}
</Collapsible>
```

Tooltip on the section header: "Commits are bucketed by the date they were authored relative to when each step was active. Messages are not parsed."

### Milestone submission form — "Import from GitHub"

`MilestoneSubmissionForm` in the same file (lines ~865–972). A new `<Button variant="outline" size="sm">` is added inside the button row at line ~942, next to the existing "Attach file" button. Only rendered when `workspace.githubLink?.status === "active"`.

Click handler:

```typescript
const res = await fetch(`/api/projects/${projectId}/github/submission-import?milestone_id=${milestoneId}`);
const { content } = await res.json();
setPastedText(content);
```

No new submission type. The existing `"pasted_text"` flow handles it. The user may edit the imported text freely before submitting.

### Presentation page — README diff

`src/components/project/project-pitch-kit-view.tsx` — new section, rendered only when:

- `workspace.projectTrack === "software"`
- `workspace.githubLink?.status === "active"`
- `workspace.githubLink.cached_readme` is present
- `trim(cached_readme) !== trim(readme_draft)`

Uses the `diff` npm package (jsdiff) — `diffLines()` over trimmed content. Rendered with red/green line backgrounds.

```
<Card className="space-y-4">
  <div>
    <p className="editorial-kicker">Your repo README is out of date vs. your Sevri draft.</p>
    <p className="mt-1 text-sm text-ink-soft">
      Pick one source of truth — or keep them in sync manually.
    </p>
  </div>
  <Collapsible title="Show diff">
    <pre className="diff">…</pre>
  </Collapsible>
</Card>
```

If the trimmed strings match, the section is omitted entirely (no "in sync" message — quiet UI when there's nothing to do).

---

## Section 8: Caching

The 5-minute server-side cache is the only cache layer. There is no Redis, no in-memory cache, no edge cache.

| Data | Location | TTL | Invalidation |
|---|---|---|---|
| Commits list | `project_github_links.cached_commits` | 5 min via `last_synced_at` | Time-based only |
| README | `project_github_links.cached_readme` + `readme_sha` | 5 min | Time-based only |
| User repo autocomplete | Not cached | — | Fresh fetch per Overview mount |

Rationale for not caching the repo autocomplete: the list of the user's public repos is small (20 rows), and the autocomplete only appears briefly during the link flow. The 5-minute cache columns are per-project and would need a separate store.

Cache is written inside the activity endpoint and read by both the activity endpoint and the submission-import endpoint (the import endpoint never triggers a GitHub call on its own — it relies on the activity endpoint's cache being populated recently).

---

## Section 9: Security

### CSRF protection

- State parameter: 32 bytes from `crypto.randomBytes`, base64url encoded (43 chars).
- Storage: `__Host-gh_oauth_state` cookie with `httpOnly; SameSite=Lax; Secure` (in production); `Path=/`; `Max-Age=600` (10 min).
- The `__Host-` prefix requires `Secure` and `Path=/` and prohibits `Domain=`, which prevents subdomain-set cookies from overriding it.
- Comparison is byte-for-byte in the callback. Cookie is cleared immediately after comparison (success or failure).

### Token handling

- Tokens are encrypted at rest (`bytea`, AES-256-GCM).
- Tokens are decrypted only inside `createGitHubClient`, never returned to any caller outside `src/lib/integrations/github/client.ts`.
- No route handler returns any token-related field. `user_integrations` rows selected through queries omit the `_encrypted` columns.
- No token is ever logged (console, Sentry breadcrumbs, metric labels). The existing Sentry `beforeSend` scrubs `access_token` as a substring, which covers transitive serialization paths.

### Project ownership

- RLS enforces `project_id` → `projects.user_id === auth.uid()` for both reads and writes on `project_github_links`.
- Route handlers additionally verify `project.user_id === user.id` before calling GitHub. This is belt-and-suspenders: RLS could one day be modified, and the handler check produces a clean 404 instead of a "zero rows" silence.

### Rate limiting

- `GET /api/projects/[id]/github/activity` is limited to 60 req/user/hour via `enforceRateLimit({ endpoint: "github_activity", maxRequests: 60, windowMinutes: 60 })`.
- Every Overview page load triggers one call, so 60/hour comfortably covers normal usage while preventing abuse.

### Scopes

- Requested scopes: `public_repo`, `read:user`. Stored in `user_integrations.scopes`.
- If GitHub's returned `scope` string does not include both, the callback still stores the integration but `status = 'invalid'` with a UI note. v2 can widen scopes; v1 holds the line.

### Not doing in v1

- No GitHub App. This is a GitHub OAuth App, which is a user-authorization flow without installation. An App would let us scope per-repo permissions more tightly but requires the student to install on each repo individually — a tax v1 does not impose.
- No token refresh. GitHub OAuth App tokens do not expire by default; 401 triggers reconnect.
- No webhook signature verification — because there are no webhooks.

---

## Section 10: Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Student completes OAuth but hits a stale GitHub edge | Callback catches `exchangeCodeForToken` failure and redirects with `?error=code_exchange_failed`. No partial row written. |
| Student revokes Sevri's access from their GitHub settings | Next activity call gets 401 → `markIntegrationInvalid` → UI shows reconnect prompt. Row kept so project links survive reconnect. |
| Linked repo deleted | Next activity call gets 404 → `markLinkBroken` → UI shows broken-link banner. Commits cache retained; user sees last known state with a dated warning. |
| Linked repo made private | Same as deleted (403/404 branch collapsed). Behavior documented in UI copy: "repo no longer reachable." |
| Linked repo renamed or transferred | Treated as deleted. v2 could detect the redirect and auto-update `repo_full_name`; v1 asks the user to re-link. |
| Large repo (>100 commits relevant) | `listCommits` capped at 100. UI footer: "Showing last 100 commits — see more on GitHub →" linking to `https://github.com/{repo}/commits/{default_branch}`. |
| README doesn't exist | `getReadme` 404 → README treated as empty string. Diff section omitted (since `cached_readme` is null). |
| README has trailing whitespace noise | Both sides are trimmed line-by-line before diffing (rtrim per line + full trim of file). Non-text README content (images) is outside scope and behaves as "no README." |
| Two browser tabs racing the OAuth callback | Harmless: the UPSERT is idempotent on `(user_id, provider)`, and state is single-use (cookie cleared on first callback). Second callback sees no cookie → `?error=state_mismatch`. |
| Student signs out mid-flow | Callback requires `requireApiStudent` → 401 → redirect to sign-in → returns to `/settings/integrations` empty-handed. No partial row. |
| Request comes through with a `code` but no matching state cookie (phishing attempt) | Callback rejects with `?error=state_mismatch`. No row written. |

---

## Section 11: Anti-Goals and v2 Deferrals

### Explicitly NOT in v1

- **Private repositories.** The `public_repo, read:user` scope pair deliberately does not grant private-repo access. Linking a private repo fails fast at the `POST …/link` step with `code: "private_repo"`.
- **Full `repo` scope.** Writing commits, opening PRs, editing files — all out of scope. Sevri is read-only against GitHub in v1 and in the intended roadmap.
- **Writing to GitHub in any form.** No commits, branches, PRs, Issues, Actions runs, comments, or releases created from Sevri.
- **In-app file browser / code viewer.** The Overview strip links to `html_url` for each commit. Students read code on GitHub.
- **Issues / Pull Requests / Actions surfacing.** Out of scope — commits and README only.
- **Tag-based or commit-message attribution.** Time-window attribution is the only mechanism. No parsing of "milestone 3", "#step2", conventional-commit prefixes, etc.
- **Webhooks.** No push-based sync. Cache-on-read with a 5-minute TTL is the v1 answer.
- **Reviewer visibility of GitHub data.** Reviewers do not see a student's connected GitHub repo, commits, or README diff in v1. A future RLS extension and UI pass can add this.
- **Multi-repo per project.** One repo per project, enforced by `unique (project_id)`.
- **Cross-project repo linking.** If a student has the same repo linked to two projects, that's fine (no uniqueness across projects), but reviewer-style cross-project surfacing is not planned.
- **Key rotation.** `INTEGRATIONS_ENCRYPTION_KEY` is a single key. Rotation requires a migration script and is deferred.

### v2 candidates (not commitments)

- Reviewer read-access to GitHub data (new RLS policy + UI gating).
- Auto-update of `repo_full_name` on GitHub rename redirects.
- Widening to GitLab / Bitbucket via the existing `user_integrations.provider` column.
- Key rotation migration script.
- Cached repo autocomplete for large-account users (hundreds of public repos).

---

## Section 12: Implementation Stages

Each stage is a separate commit. `npm run typecheck && npm run lint` must pass at the end of each, and the manual verification listed must be executed locally before moving on.

1. **Migrations + encryption.** Write `0010_*.sql`, `src/lib/integrations/github/encryption.ts`, `scripts/verify-encryption.ts`. Apply migration. Run the verify script.
2. **OAuth + Settings page.** Add env vars and schema. Build `oauth.ts`, authorize/callback/DELETE routes, `/settings/integrations` page. Verify: connect → `user_integrations` row decrypts cleanly; disconnect → row gone.
3. **Project linking.** `link` / `unlink` routes, `limits.ts` / `feature-access.ts` changes, `project_github_links` UPSERT, Overview "link state" UI only. Verify: Pro links a public repo; free hits upgrade error; Pro tries a private repo → `private_repo` error.
4. **Activity endpoint + Overview card.** `client.ts`, `cache.ts`, `activity` route, Overview commit strip. Verify: commits render; second request within 5 min hits cache (inspect `last_synced_at` unchanged).
5. **Milestone attribution + per-step list.** `attribution.ts`, wire into activity response, render the collapsible per-milestone list in `project-step-workspace.tsx`.
6. **Submission import.** `submission-import` route + button in `MilestoneSubmissionForm`. Verify: click populates textarea with trimmed content ≤ 20 000 chars.
7. **README diff.** `diff` package installed, Presentation page diff section. Verify: modify repo README → diff shows changes; restore → section disappears.

After Stage 7: one final manual end-to-end pass on a fresh test account covering free-plan upgrade prompt, pro connect + link + activity render + submission import + diff.
