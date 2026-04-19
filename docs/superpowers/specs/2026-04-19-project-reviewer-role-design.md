# Project Reviewer Role

**Date:** 2026-04-19
**Status:** Draft — pending review

## Overview

Pro students can invite up to 2 outside reviewers (teachers, mentors, parents) per project. Each reviewer gets their own Supabase-auth account with `user_role = 'reviewer'`, a read-only mirror of the student's workspace at `/reviewer/project/[id]`, and a structured three-field review form per milestone. Reviewers cannot write anywhere except `milestone_reviews`. Students see the latest per-reviewer review beneath each milestone's AI evaluation.

Invitation is always email-based. An invitation produces a single-use cryptographic token; the reviewer clicks a link in the email, signs up (or signs in if returning), and accepts. Tokens are never logged and never echoed in any API response after the moment of creation. The invitation email is the teacher's first impression of the product, so the template copy is treated as a serious surface, not a dev placeholder.

---

## Section 1: Database

Migration: `supabase/migrations/0008_project_reviewer_role.sql` — written but not applied (Tyler applies migrations manually).

### `profiles` (alter)

Two additive columns:

```sql
alter table public.profiles
  add column user_role text not null default 'student'
    check (user_role in ('student', 'reviewer')),
  add column display_name text;
```

- `user_role` is the authoritative source of truth for role gating. Middleware and guards read it from this table, never from `auth.users.raw_user_meta_data`.
- `display_name` is nullable. Reviewers fill it in during acceptance; students may also set one from settings later. Fallback chain everywhere display is needed: `display_name → full_name → email local-part → "A reviewer"` (or `"A student"`).
- Default `'student'` is safe — existing rows become students, and that matches reality. The invite accept flow sets `'reviewer'` explicitly on the row it upserts.

### `project_invitations`

Pending state per invited email. Consumed by acceptance.

```sql
create table public.project_invitations (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  inviter_user_id      uuid not null references auth.users(id) on delete cascade,
  reviewer_email       text not null,
  reviewer_email_lower text not null,
  token                text not null unique,
  personal_note        text,
  status               text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null default (now() + interval '14 days'),
  accepted_at          timestamptz,
  accepted_by_user_id  uuid references auth.users(id) on delete set null
);
```

- `reviewer_email_lower` is a generated/normalized lowercase mirror. All email comparisons (re-invite check, acceptance email match) use this column. Stored as a plain column (not a generated column) so legacy Postgres editions behave predictably; the mutation writes both values together.
- `token`: result of `crypto.randomBytes(32).toString("base64url")` — 43-character URL-safe string, ≥256 bits of entropy. Stored plain. Never logged. No index needed beyond the implicit unique index.
- `expires_at` defaults to 14 days.
- `personal_note`: optional ≤500 chars, included verbatim in the invitation email body.

Indexes:

```sql
create index idx_project_invitations_project_status
  on public.project_invitations(project_id, status);
create index idx_project_invitations_inviter_created
  on public.project_invitations(inviter_user_id, created_at desc);
create unique index idx_project_invitations_project_email_pending
  on public.project_invitations(project_id, reviewer_email_lower)
  where status = 'pending';
```

The partial unique index prevents two concurrent pending invitations to the same email on the same project.

RLS:

```sql
alter table public.project_invitations enable row level security;

create policy p_project_invitations_owner on public.project_invitations for all
using (inviter_user_id = auth.uid())
with check (inviter_user_id = auth.uid());
```

- Owner (inviter) can SELECT / INSERT / UPDATE (to revoke) / DELETE.
- No policy grants anon access. Acceptance reads via the service-role client. Compromise of any authenticated user cannot enumerate tokens.

### `project_reviewers`

Confirmed reviewer membership per project.

```sql
create table public.project_reviewers (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  reviewer_user_id   uuid not null references auth.users(id) on delete cascade,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  joined_at          timestamptz not null default now(),
  revoked_at         timestamptz,
  unique (project_id, reviewer_user_id)
);

create index idx_project_reviewers_project_active
  on public.project_reviewers(project_id) where revoked_at is null;
create index idx_project_reviewers_reviewer_active
  on public.project_reviewers(reviewer_user_id) where revoked_at is null;
```

- "Active" (confirmed and not revoked) means `revoked_at is null`. Every downstream RLS check on reviewer visibility includes this filter.
- A revoked reviewer who is re-invited updates the existing row: `revoked_at = null`, fresh `joined_at`. Historical `milestone_reviews` remain visible to both sides as a record.

RLS:

```sql
alter table public.project_reviewers enable row level security;

create policy p_project_reviewers_owner on public.project_reviewers for all
using (
  exists (select 1 from public.projects p
          where p.id = project_id and p.user_id = auth.uid())
)
with check (
  exists (select 1 from public.projects p
          where p.id = project_id and p.user_id = auth.uid())
);

create policy p_project_reviewers_self_select on public.project_reviewers
for select
using (reviewer_user_id = auth.uid());
```

- Owner can see and manage all rows for their projects (including DELETE to revoke, though we prefer `update set revoked_at = now()` to preserve history — the DELETE is available but not used in normal flow).
- Reviewer can SELECT their own rows (for `/reviewer` dashboard).

### `milestone_reviews`

Structured, append-only review entries. Edits create new rows; a trigger marks prior rows superseded.

```sql
create table public.milestone_reviews (
  id                     uuid primary key default gen_random_uuid(),
  milestone_id           uuid not null references public.milestones(id) on delete cascade,
  reviewer_user_id       uuid not null references auth.users(id) on delete cascade,
  submission_id          uuid references public.milestone_submissions(id) on delete set null,
  strength               text not null check (char_length(strength) between 10 and 500),
  tighten                text not null check (char_length(tighten) between 10 and 500),
  next_action            text not null check (char_length(next_action) between 10 and 500),
  ready_to_mark_complete boolean not null,
  created_at             timestamptz not null default now(),
  superseded_at          timestamptz
);

create index idx_milestone_reviews_milestone_latest
  on public.milestone_reviews(milestone_id, reviewer_user_id)
  where superseded_at is null;
create index idx_milestone_reviews_milestone_created
  on public.milestone_reviews(milestone_id, created_at desc);
```

- `submission_id` is nullable and `set null on delete` — a review may be left without a pinned submission, and deleting a submission should not delete the review record.
- `ready_to_mark_complete` is advisory to the student; it does not toggle `milestones.completed`.
- No UPDATE or DELETE policies. The table is append-only at the RLS layer.

Trigger — mirrors the existing `set_milestone_submission_latest` pattern:

```sql
create or replace function public.set_milestone_review_superseded()
returns trigger
language plpgsql
as $$
begin
  update public.milestone_reviews
  set superseded_at = now()
  where milestone_id = new.milestone_id
    and reviewer_user_id = new.reviewer_user_id
    and id != new.id
    and superseded_at is null;
  return new;
end;
$$;

create trigger trg_milestone_reviews_superseded
after insert on public.milestone_reviews
for each row execute function public.set_milestone_review_superseded();
```

RLS:

```sql
alter table public.milestone_reviews enable row level security;

create policy p_milestone_reviews_reviewer_insert on public.milestone_reviews
for insert
with check (
  reviewer_user_id = auth.uid()
  and exists (
    select 1
    from public.milestones m
    join public.project_reviewers pr on pr.project_id = m.project_id
    where m.id = milestone_id
      and pr.reviewer_user_id = auth.uid()
      and pr.revoked_at is null
  )
);

create policy p_milestone_reviews_owner_select on public.milestone_reviews
for select
using (
  exists (
    select 1
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.id = milestone_id and p.user_id = auth.uid()
  )
);

create policy p_milestone_reviews_reviewer_select on public.milestone_reviews
for select
using (reviewer_user_id = auth.uid());
```

- Only reviewers can INSERT, only for milestones in projects where they are active reviewers.
- Students (project owners) can SELECT reviews on their own milestones.
- Reviewers can SELECT their own reviews. Reviewers do **not** see other reviewers' reviews (only the project owner sees the cross-reviewer view). This keeps reviewer judgments independent.
- No UPDATE or DELETE policies — revisions happen via fresh INSERT + trigger.

### RLS extensions on existing tables

Reviewers need SELECT on `projects`, `project_roadmaps`, `milestones`, `milestone_submissions`, and `milestone_submission_evaluations` to render the mirror view. Following the split-policy precedent from migration 0006, each is added as a new SELECT-only policy rather than ORed into the existing owner policy:

```sql
create policy p_projects_reviewer_select on public.projects
for select
using (
  exists (
    select 1 from public.project_reviewers pr
    where pr.project_id = id
      and pr.reviewer_user_id = auth.uid()
      and pr.revoked_at is null
  )
);

create policy p_project_roadmaps_reviewer_select on public.project_roadmaps
for select
using (
  exists (
    select 1 from public.project_reviewers pr
    where pr.project_id = project_id
      and pr.reviewer_user_id = auth.uid()
      and pr.revoked_at is null
  )
);

create policy p_milestones_reviewer_select on public.milestones
for select
using (
  exists (
    select 1 from public.project_reviewers pr
    where pr.project_id = project_id
      and pr.reviewer_user_id = auth.uid()
      and pr.revoked_at is null
  )
);

create policy p_milestone_submissions_reviewer_select on public.milestone_submissions
for select
using (
  exists (
    select 1 from public.milestones m
    join public.project_reviewers pr on pr.project_id = m.project_id
    where m.id = milestone_id
      and pr.reviewer_user_id = auth.uid()
      and pr.revoked_at is null
  )
);

create policy p_milestone_submission_evaluations_reviewer_select on public.milestone_submission_evaluations
for select
using (
  exists (
    select 1
    from public.milestone_submissions ms
    join public.milestones m on m.id = ms.milestone_id
    join public.project_reviewers pr on pr.project_id = m.project_id
    where ms.id = submission_id
      and pr.reviewer_user_id = auth.uid()
      and pr.revoked_at is null
  )
);
```

- Reviewers never receive INSERT / UPDATE / DELETE policies on these tables.
- Existing owner policies are untouched.

---

## Section 2: Auth & Middleware

### Role lookup

Middleware (`src/lib/supabase/middleware.ts`) fetches `profiles.user_role` on every authenticated request, using the same SSR Supabase client that already reads `auth.getUser()`. One extra query per request. No cross-request cache — the request's Supabase client owns its own session.

```typescript
const { data: profile } = await supabase
  .from("profiles")
  .select("user_role")
  .eq("user_id", user.id)
  .maybeSingle();

const role = (profile?.user_role ?? "student") as UserRole;
```

- If `profiles` row does not exist (mid-signup), treat as `'student'`. The onboarding flow upserts the profile, and the accept-invitation route upserts with `'reviewer'`.

### Path classification

| Group | Paths |
|---|---|
| `PROTECTED_PATHS` (unchanged) | `/dashboard`, `/onboarding`, `/recommendations`, `/project`, `/billing`, `/settings`, `/reviewer` |
| `STUDENT_ONLY_PATHS` | `/dashboard`, `/onboarding`, `/recommendations`, `/project` |
| `REVIEWER_ONLY_PATHS` | `/reviewer` |
| `PUBLIC_BYPASS_PATHS` | `/accept-invitation` |
| `AUTH_PATHS` (unchanged) | `/sign-in`, `/sign-up` |

`/billing` and `/settings` are deliberately shared — both roles have billing (reviewers who upgrade, students on Pro) and profile settings.

### Redirect table

Evaluated in order. First match wins.

| Condition | Action |
|---|---|
| path matches `PUBLIC_BYPASS_PATHS` | proceed (no auth required) |
| no user + path matches `PROTECTED_PATHS` | redirect `/sign-in?next=<path>` |
| user + path matches `AUTH_PATHS` | redirect `role === 'reviewer' ? '/reviewer' : '/dashboard'` |
| user + role === 'reviewer' + path matches `STUDENT_ONLY_PATHS` | redirect `/reviewer` |
| user + role === 'student' + path matches `REVIEWER_ONLY_PATHS` | redirect `/dashboard` |
| otherwise | proceed |

### Server-side guards

Added to `src/lib/auth/guard.ts`:

```typescript
export async function getRequiredStudentUser() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("profiles").select("user_role").eq("user_id", user.id).maybeSingle();
  if ((data?.user_role ?? "student") !== "student") redirect("/reviewer");
  return user;
}

export async function getRequiredReviewerUser() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("profiles").select("user_role").eq("user_id", user.id).maybeSingle();
  if (data?.user_role !== "reviewer") redirect("/dashboard");
  return user;
}
```

Added to `src/lib/auth/api.ts`:

```typescript
export async function requireApiStudent():
  Promise<{ user: User | null; response: NextResponse | null }>;
export async function requireApiReviewer():
  Promise<{ user: User | null; response: NextResponse | null }>;
```

Both build on `requireApiUser`, then query role and return a `403` JSON response (`{ error: "Forbidden", code: "wrong_role" }`) if the role is wrong. Pages use the redirect helpers; API routes use the 403 helpers.

---

## Section 3: API Routes

### `POST /api/projects/[id]/invitations`

Student creates a reviewer invitation.

**Request body schema** (`src/lib/validators/reviewer.ts`):

```typescript
export const inviteReviewerSchema = z.object({
  reviewer_email: z.string().email().max(254),
  personal_note:  z.string().max(500).optional(),
});
```

**Route sequence:**

1. `requireApiStudent()` → returns `{user}` or 401/403 response.
2. `assertFeatureAccess({ userId: user.id, feature: "invite_reviewer" })` → if `!allowed` return `createUpgradeRequiredResponse`.
3. Load project by id; verify `user_id === user.id` → `404` if not found.
4. Reject if `reviewer_email_lower === user.email.toLowerCase()` → `400 cannot_invite_self`.
5. Count active reviewers + pending invitations for project. If `count >= reviewerLimit(plan)` → `400 reviewer_limit_reached`.
6. Reject duplicate pending invitation to the same email (the partial unique index also enforces) → `409 invitation_already_pending`.
7. `enforceRateLimit({ endpoint: "invitations:project:<projectId>", maxRequests: 5, windowMinutes: 1440 })` → `429` if hit.
8. `enforceRateLimit({ endpoint: "invitations:inviter", maxRequests: 20, windowMinutes: 1440 })` → `429` if hit.
9. Generate token: `crypto.randomBytes(32).toString("base64url")`.
10. Insert `project_invitations` row (plain token, `reviewer_email_lower` normalized).
11. Build email body via `reviewerInvitationTemplate({ inviterName, projectTitle, acceptUrl, personalNote })`.
12. `sendEmail(reviewer_email, subject, html)` — on failure, delete the invitation row and return `502 email_send_failed` so the user can retry without a dangling row.
13. Return `201` with sanitized invitation (no token):

```typescript
{
  invitation: {
    id: string,
    project_id: string,
    reviewer_email: string,   // original case
    status: "pending",
    created_at: string,
    expires_at: string,
  }
}
```

### `DELETE /api/projects/[id]/invitations/[invitationId]`

Student revokes a pending invitation.

**Sequence:**

1. `requireApiStudent()`.
2. Load invitation by id; verify `project_id === [id]` and `inviter_user_id === user.id`.
3. If `status !== 'pending'` → `409 invitation_not_pending`.
4. `update status = 'revoked'`.
5. Return `200 { invitation_id, status: "revoked" }`.

### `DELETE /api/projects/[id]/reviewers/[reviewerId]`

Student removes a confirmed reviewer.

**Sequence:**

1. `requireApiStudent()`.
2. Load project by `[id]`; verify `user_id === user.id`.
3. Load `project_reviewers` row by `[reviewerId]`; verify matches `[id]` and `revoked_at is null`.
4. `update set revoked_at = now()` (soft revoke — preserves historical `milestone_reviews` attribution).
5. Return `200 { reviewer_id, status: "revoked" }`.

### `POST /api/invitations/[token]/accept`

**Public — no `requireApiUser`.** Uses service-role client to validate the token and write the acceptance. Called by the `/accept-invitation/[token]` page once the reviewer is authenticated with a matching email.

**Sequence:**

1. Read `supabase.auth.getUser()` via server client — required because acceptance needs a signed-in user. If no user → `401`.
2. Service-role client: look up invitation by `token`.
3. If not found → `404 invitation_not_found`.
4. If `status === 'accepted'` → `410 invitation_already_accepted`.
5. If `status === 'revoked'` → `410 invitation_revoked`.
6. If `status === 'expired'` or `expires_at < now()` → `410 invitation_expired`.
7. If `auth_user.email.toLowerCase() !== reviewer_email_lower` → `403 email_mismatch`.
8. Look up existing profile for `auth_user.id`:
   - If exists and `user_role === 'student'` → `409 student_account_cannot_accept`. Do not modify.
   - If exists and `user_role === 'reviewer'` → keep as-is.
   - If does not exist → insert with `user_role = 'reviewer'`, `full_name = null`, `display_name = null`, letting the user fill in later.
9. Upsert `project_reviewers` on `(project_id, reviewer_user_id)` → `revoked_at = null`, `joined_at = now()`, `invited_by_user_id = invitation.inviter_user_id`.
10. `update project_invitations` → `status = 'accepted'`, `accepted_at = now()`, `accepted_by_user_id = auth_user.id`.
11. Return `200 { project_id, reviewer_id }`. Token never echoed.

All branches that reject must return **generic** error shapes to clients — internal reasons (`revoked`, `expired`, etc.) can be revealed since they don't leak token existence, but the error copy in UI is a single "This invitation is no longer valid" regardless.

### `POST /api/milestones/[id]/reviews`

Reviewer creates a new review. Prior reviews from the same reviewer are auto-superseded by the DB trigger.

**Request body schema:**

```typescript
export const milestoneReviewSchema = z.object({
  strength:               z.string().min(10).max(500),
  tighten:                z.string().min(10).max(500),
  next_action:            z.string().min(10).max(500),
  ready_to_mark_complete: z.boolean(),
  submission_id:          z.string().uuid().optional(),
});
```

**Sequence:**

1. `requireApiReviewer()`.
2. Load milestone by `[id]`; verify an active `project_reviewers` row exists for `(milestone.project_id, user.id)` → `403 not_a_reviewer`.
3. If `submission_id` provided, verify it belongs to this milestone → `400 submission_mismatch`.
4. Insert `milestone_reviews` row; trigger supersedes prior ones.
5. Return `201 { review }` with the inserted row.

### `GET /api/milestones/[id]/reviews`

Returns all non-superseded reviews for the milestone. Visible to the project owner and to active reviewers of the same project (reviewers see only their own per RLS).

**Sequence:**

1. `requireApiUser()` (either role may call).
2. Load milestone; verify the caller is either project owner or an active reviewer on the project → `403` if neither.
3. `select` `milestone_reviews.* + reviewer profile (display_name, full_name)` where `milestone_id = [id] and superseded_at is null`. RLS already narrows to the allowed subset; the app-level check above is belt-and-suspenders for clearer 403 vs empty-array semantics.
4. Return `200 { reviews: ReviewWithReviewer[] }` where each includes reviewer display info (already computed via `display_name ?? full_name ?? "Reviewer"`).

---

## Section 4: UI

### Accept-invitation page — `/accept-invitation/[token]`

Public server component at `src/app/accept-invitation/[token]/page.tsx`. Reads the token, validates via service-role `getInvitationByToken(token)`, branches into one of four states. No student-app chrome — uses marketing-layout styling.

| State | Condition | Render |
|---|---|---|
| _invalid_ | not found / revoked / expired / already-accepted | Error card: "This invitation is no longer valid. Ask your student to send a new one." Links: home, contact support. |
| _unauthed_ | valid + no session | Invite card: inviter name, project title, personal note (if present), plain-language "what Sevri is" paragraph, magic-link sign-up form pre-filled with `reviewer_email` (read-only field). Magic-link redirect callback set to `?next=/accept-invitation/<token>`. |
| _wrong role_ | valid + signed in as `user_role === 'student'` | Rejection card: "This invitation is for a reviewer account. You're signed in as a student — sign out to create a reviewer account, or ask your student to use a different email." Buttons: sign out, go home. |
| _wrong email_ | valid + signed in + email mismatch | "This invitation was sent to a different address. Sign out and sign back in with the invited email." |
| _ready_ | valid + signed in as reviewer + email matches | Accept card: "Accept invitation to review <project title>". Button: **Accept invitation** → POST `/api/invitations/[token]/accept` → on success, router.push(`/reviewer/project/<project_id>`). |

Layout (ready state):

```
┌─ You've been invited to review ─────────────────────────┐
│  <inviter_full_name> invited you to review              │
│  <project_title> on Sevri.                              │
│                                                          │
│  <personal_note — rendered only if present>             │
│                                                          │
│  Sevri helps students pick and finish realistic         │
│  portfolio projects. As a reviewer, you'll see their    │
│  progress and leave structured feedback on each         │
│  milestone. You won't edit their work or be billed      │
│  — reviewer accounts are free.                          │
│                                                          │
│                                 [ Accept invitation ]   │
└──────────────────────────────────────────────────────────┘
```

### Reviewer dashboard — `/reviewer`

Server component. Gated by `getRequiredReviewerUser()`. Fetches via `listReviewerProjects(userId)`:

```typescript
{
  projects: Array<{
    project_id: string,
    student_display_name: string,      // student's display_name ?? full_name ?? "A student"
    project_title: string,
    last_student_activity_at: string,  // latest milestone update or submission ts
    unreviewed_milestone_count: number // milestones with no non-superseded review by this reviewer
  }>
}
```

Layout: simple list of project cards. No create/onboarding UI. No "invite" affordance. Each card is clickable and routes to `/reviewer/project/<id>`.

Empty state: "No projects yet. Once a student invites you, their project will appear here."

### Reviewer project view — `/reviewer/project/[id]`

Server component. Gated by `getRequiredReviewerUser()` and `getReviewerProjectWorkspace(projectId, user.id)` which:

1. Asserts an active `project_reviewers` row exists for `(projectId, user.id)` → 404 if not.
2. Fetches project, roadmap, milestones, submissions, evaluations — all narrowed by RLS to this reviewer's visible set.
3. Returns the same shape as `getProjectWorkspace` plus a `role: 'reviewer'` marker.

Rendering reuses:

- `<ProjectOverviewView />` with `readOnly` prop → hides any future "edit" affordances.
- `<ProjectScopeView />`, `<ProjectResearchLensView />`, `<ProjectPitchKitView />` — read-only as-is (no interactive elements).
- `<MilestoneChecklist />` with `readOnly` prop → hides toggle-complete and submission form; still renders stored submission + evaluation; adds the `<LeaveReviewPanel />` beneath the evaluation for milestones where no submission yet exists (reviewer can leave a review either way).
- Sidebar navigation shows the same five tabs (Overview, Scope & Guardrails, Research Lens, Milestones, Presentation) with routes under `/reviewer/project/<id>/...` instead of `/project/<id>/...`. Sub-routes mirror the student tree.

### `<LeaveReviewPanel />` — reviewer-side milestone panel

Rendered inside `<MilestoneChecklist />` beneath the AI evaluation, after a `border-t border-line pt-5` divider, only when `role === 'reviewer'`.

```
┌─ Your review ───────────────────────────────────────────┐
│  Strength — what's working                              │
│  [ textarea · 10–500 chars · counter ]                  │
│                                                          │
│  Tighten — what to improve                              │
│  [ textarea · 10–500 chars · counter ]                  │
│                                                          │
│  Next action — the single most useful next step         │
│  [ textarea · 10–500 chars · counter ]                  │
│                                                          │
│  [ ] Ready to mark complete                             │
│                                                          │
│                                    [ Submit review ]    │
└──────────────────────────────────────────────────────────┘
```

If the reviewer has a prior non-superseded review on this milestone, the form renders with values pre-filled and the button label becomes "Update review". Submitting POSTs to `/api/milestones/[id]/reviews`; the server trigger supersedes the prior row, and the client replaces the rendered row.

Below the form, a "Your previous reviews" disclosure lists the reviewer's own superseded reviews for this milestone (read-only, collapsed by default) — reviewers need to see their own history, but not other reviewers' reviews.

### Student-side milestone panel — `<ReviewerFeedbackPanel />`

Rendered inside `<MilestoneChecklist />` beneath the AI evaluation, after a `border-t border-line pt-5` divider, only when `role === 'student'` and at least one active reviewer exists for the project. Fetched alongside guidance/submission on panel open.

```
┌─ Reviewer feedback ─────────────────────────────────────┐
│  Ms. Chen · Apr 18 · [ Ready ]                          │
│    Strength  — <strength>                                │
│    Tighten   — <tighten>                                 │
│    Next      — <next_action>                             │
│                                                          │
│  Dad · Apr 19 · [ Not yet ]                              │
│    Strength  — <strength>                                │
│    Tighten   — <tighten>                                 │
│    Next      — <next_action>                             │
└──────────────────────────────────────────────────────────┘
```

One block per reviewer (latest non-superseded row only). Reviewer display: `display_name ?? full_name ?? "Reviewer"`. Pill colors: `Ready` = success tone, `Not yet` = muted tone. If no reviews exist yet for this milestone, the panel is absent entirely (not a "no feedback yet" empty state — avoids noise).

### Student-side Overview — `<ReviewersCard />`

New card on `src/components/project/project-overview-view.tsx`, placed in the existing two-column grid alongside Stay-finishable / Project-lens.

```
┌─ Reviewers · 1 of 2 ─────────────────── [ Invite ] ─┐
│  ● Ms. Chen                            [ Revoke ]   │
│  ◐ t***@school.edu · Pending · sent Apr 18  [Revoke]│
└──────────────────────────────────────────────────────┘
```

- Header shows `{active + pending} of {reviewerLimit(plan)}`. For free plan, shows `0 of 2 · Upgrade to Pro to invite` and the Invite button links to `/billing` instead of opening the modal.
- Active reviewers: `display_name` if set, else masked email (first char + `***@domain`). Revoke button → DELETE `/api/projects/[id]/reviewers/[reviewerId]`.
- Pending: masked email + relative time + Revoke button → DELETE `/api/projects/[id]/invitations/[invitationId]`.
- Invite button (Pro only): opens `<ReviewerInviteModal />`.

### `<ReviewerInviteModal />`

Two fields:

| Field | Validation | Display |
|---|---|---|
| `reviewer_email` | required email | "Reviewer's email" |
| `personal_note` | optional, ≤500 chars | "Add a note (optional)" textarea — rendered verbatim in the email |

Submit button: "Send invitation". Disabled if plan !== 'pro_monthly' or active+pending count ≥ 2. On success: toast-style inline success alert + reload of the Reviewers card. On plan violation / limit error: inline error message from API response.

### User-friendly labels (no raw enum text)

| Raw value | Display |
|---|---|
| `user_role: 'student'` | Student |
| `user_role: 'reviewer'` | Reviewer |
| `status: 'pending'` | Pending |
| `status: 'accepted'` | Accepted |
| `status: 'revoked'` | Revoked |
| `status: 'expired'` | Expired |
| `ready_to_mark_complete: true` | Ready (success tone) |
| `ready_to_mark_complete: false` | Not yet (muted tone) |

### Email template — `reviewerInvitationTemplate`

New export in `src/lib/email/templates.tsx`:

```typescript
interface ReviewerInvitationArgs {
  inviterName:    string;   // full_name or "A student"
  projectTitle:   string;
  acceptUrl:      string;   // absolute URL to /accept-invitation/<token>
  personalNote?:  string;
}

export function reviewerInvitationTemplate(args: ReviewerInvitationArgs): {
  subject: string;
  html:    string;
}
```

Subject: `${inviterName} invited you to review their Sevri project`

HTML (rendered as a plain-but-polished HTML email; same inline-styled div pattern the existing templates use, expanded to a readable block):

- Greeting with the inviter's name and project title.
- Personal note block (only if present) — quoted visually, attributed to the inviter.
- One-paragraph "what Sevri is" explainer: "Sevri helps students pick and finish realistic portfolio projects. As a reviewer, you'll see their progress and leave structured feedback on each milestone. Reviewer accounts are free."
- Clear primary CTA button linking to `acceptUrl`. Fallback plain-text URL below.
- Signature line: "— The Sevri team".

The URL is built from `clientEnv.NEXT_PUBLIC_APP_URL` plus `/accept-invitation/<token>`. If `NEXT_PUBLIC_APP_URL` is missing, the API route hard-fails before sending (we never send a relative URL in an email).

---

## Section 5: Security & Open Questions

### Token handling

- Generated with `crypto.randomBytes(32).toString("base64url")` → 256 bits of entropy, URL-safe.
- Stored plain in `project_invitations.token`. RLS denies all anon access to this table; only the service-role client (used exclusively by the acceptance route) can read tokens.
- **Never logged.** No `console.log(token)`, no Sentry `extra: { token }`, no `captureServerError(..., { token })`. The invitation record is identified in logs by `invitation_id` only.
- **Never echoed in any API response after creation.** The POST `/api/projects/[id]/invitations` response sanitizes the row before returning.
- Single-use: acceptance sets `status = 'accepted'`. Any subsequent POST to the same token returns `410` with `invitation_already_accepted`.
- Expiry enforced server-side at acceptance time (not only by a cron). Default 14 days from creation.

### Email normalization

- `reviewer_email_lower` stores the lowercase form. All comparisons (duplicate invitation check, acceptance match) use this column.
- The display `reviewer_email` preserves original casing for UI.
- Acceptance compares `auth.user.email.toLowerCase()` against `reviewer_email_lower`.

### Self-invite prevention

- Invite POST rejects if `user.email.toLowerCase() === reviewer_email_lower`.
- Additionally, the acceptance route catches the same condition via the wrong-role branch (a student's own account is already `user_role = 'student'`, so the acceptance would reject with `student_account_cannot_accept`). Defense in depth.

### Rate limits

| Scope | Limit | Window |
|---|---|---|
| Invitations per project per inviter | 5 | 1 day |
| Invitations per inviter (all projects) | 20 | 1 day |

Stored via the existing `enforceRateLimit` → `usage_events` channel (`rate_limit:invitations:project:<projectId>` and `rate_limit:invitations:inviter`). Both checks must pass before the invitation row is inserted.

### No free-form comments

Reviews are exactly `strength`, `tighten`, `next_action`, `ready_to_mark_complete`. No `comments` column, no chat thread, no "notes" field. The `personal_note` on `project_invitations` is the only free-form text reviewers ever see from the student, and it is one-shot at invitation time.

### No reviewer write access outside `milestone_reviews`

Reviewer-side SELECT policies are added on `projects`, `project_roadmaps`, `milestones`, `milestone_submissions`, `milestone_submission_evaluations`. No INSERT / UPDATE / DELETE policies are added on any of those. `milestone_reviews` is the only table where a reviewer has INSERT — and that table has no UPDATE or DELETE for anyone (append-only).

### No role auto-conversion

- Accepting an invitation while signed in as a student → rejected with `409 student_account_cannot_accept`. Never rewrites `user_role`.
- A reviewer cannot upgrade to a student via any flow in this release. (Out of scope; support case for now.)

### Middleware performance

- Adds one `profiles` select per authenticated request. Acceptable at current scale. If this becomes a hot path, cache on the Supabase cookie response or move to an `auth.users` metadata JWT claim; both are deferred.

---

### Open questions

1. **`display_name` column — add or rename?** The request references `profiles.display_name`, but the column is currently `full_name`. **Proposed:** add a nullable `display_name text` column alongside `full_name`. `full_name` stays authoritative for legal/onboarding contexts; `display_name` is what we show in reviewer lists and email. Fallback chain: `display_name → full_name → email local-part → "A reviewer"` (or `"A student"`). If Tyler prefers renaming, the migration becomes more invasive.

2. **Read-only rendering — shared component with `readOnly` prop vs separate renderer?** The reviewer project view needs the same visual shell as the student view. **Proposed:** add `readOnly?: boolean` to `<MilestoneChecklist />` and (trivially) to the overview / scope / research-lens views. The prop hides interactive affordances and shows no new surfaces. Alternative: build a `<ReviewerProjectView />` that calls the same presentational sub-components with a hard-coded `readOnly={true}`. Proposed approach is the cheaper one; flag if Tyler wants stronger separation.

3. **RLS extension — OR clause in the existing policy vs separate SELECT-only policy?** The request says "extend existing RLS policies with an OR clause." **Proposed:** add separate `p_<table>_reviewer_select` policies instead, following the split precedent in migration 0006. Easier to audit, independently revocable if the feature is rolled back. Functionally equivalent — a row is returned if any applicable policy permits it.

4. **Post auth-page redirect for reviewers.** Current middleware redirects authed users hitting `/sign-in` or `/sign-up` to `/dashboard`. **Proposed:** branch on role → reviewers to `/reviewer`, students to `/dashboard`.

5. **Inviter display name in the email — `full_name`, `display_name`, or a prompt to set one?** `full_name` is populated during onboarding and may be a formal legal form the student would not want their teacher to see. **Proposed:** use `display_name ?? full_name ?? "A student"` for the email salutation. If Tyler wants students to explicitly set a display name before their first invitation, add a required-field check to the invite modal in a later pass. Not blocking for v1.

6. **Magic-link sign-up mechanics.** Whether Supabase passes `user_metadata` through magic-link signup that we could read in a DB trigger. **Proposed:** do not depend on metadata. The acceptance route upserts `profiles.user_role = 'reviewer'` explicitly using the service-role client. `profiles` is the only source of truth for role.

7. **Re-review flow.** Edits produce new rows; prior rows are marked superseded by a trigger on (`milestone_id`, `reviewer_user_id`). **Proposed:** trigger `set_milestone_review_superseded` fires after insert, sets `superseded_at = now()` on all prior active rows matching that pair. The newly-inserted row's `superseded_at` stays null until further edits.

8. **Revoke-then-re-invite preserves history.** If a student revokes a reviewer and later re-invites the same email, we update the existing `project_reviewers` row (`revoked_at = null`, fresh `joined_at`). Old `milestone_reviews` remain visible to both sides as a historical record. Flag if Tyler prefers hard-delete-on-revoke with cascade; the soft-delete preserves the audit trail and aligns with the codebase's existing "never lose data" bias.

9. **Reviewer-to-reviewer visibility.** Reviewers can see their own reviews but not other reviewers' reviews on the same project (only the project owner sees the cross-reviewer view). **Proposed:** keep it that way — independent judgments are more useful to the student. Flag if Tyler wants reviewers to see each other's feedback.

10. **Email deliverability failure behavior.** If Resend rejects the send, we delete the freshly-inserted invitation row and return `502` so the user can retry cleanly without a dangling pending invite. **Proposed:** that behavior. Alternative: keep the invitation with a `status = 'pending'` and queue a retry — out of scope for v1.

11. **Error-response copy.** The acceptance route distinguishes `invitation_already_accepted`, `invitation_revoked`, `invitation_expired` for observability, but the `/accept-invitation/[token]` page collapses all of them into one "This invitation is no longer valid" message. **Proposed:** that split — internal codes for logs, single generic message in UI.
