# Supabase advisor reconciliation — 2026-07-25

This review used the linked managed Supabase project only for read-only advisor,
catalog, statistics, and migration-history queries. No production migration,
Auth setting, grant, policy, function, index, or row was changed.

## Current official guidance checked

- [Row Level Security performance recommendations](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations):
  wrap stable request functions such as `auth.uid()` in `select` so PostgreSQL
  can use an initPlan, index policy columns, and target policies with `TO`.
- [Password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection):
  leaked-password protection uses the HaveIBeenPwned Pwned Passwords API and is
  available on the Pro plan and above.
- [Database Branching](https://supabase.com/docs/guides/deployment/branching) and
  the [GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration):
  preview/persistent branches are isolated projects; production deployment
  should be tied to the designated production Git branch; migrations under
  `supabase/migrations` are applied by the deployment workflow.
- [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod):
  deploy consistently from the production branch rather than manually pushing
  from developer workstations.
- The current [breaking-change changelog](https://supabase.com/changelog?types=breaking-change)
  was reviewed. The relevant upcoming managed-platform change is explicit Data
  API grants for new public objects. The new public RPC wrapper in this change
  therefore has an explicit `authenticated` execute grant; its private
  implementation is intentionally not exposed. The self-hosted Postgres/Studio
  changes do not apply to this managed project.

## Live advisor snapshot

The refreshed advisor results supersede the earlier 13-unused-index snapshot.

| Advisor category | Finding | Live count |
| --- | --- | ---: |
| Security | RLS enabled with no policy | 2 |
| Security | Authenticated SECURITY DEFINER function executable | 1 |
| Security | Leaked-password protection disabled | 1 |
| Performance | `auth_rls_initplan` | 31 |
| Performance | Multiple permissive policies | 42 |
| Performance | Unindexed foreign keys | 21 |
| Performance | Unused indexes | 16 |

The 42 multiple-policy notices are six role expansions for each of seven
tables. The policies were created without `TO`, so PostgreSQL treated them as
`PUBLIC`; the advisor consequently evaluated them for inherited/internal roles
in addition to `anon` and `authenticated`.

Remediation references returned by the live advisor:

- [`auth_rls_initplan`](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)
- [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- [authenticated SECURITY DEFINER function](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [RLS enabled with no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

## Local fixes prepared

### RLS and RPC hardening

Migration:
`20260726012305_harden_rls_and_submission_rpc.sql`

The migration:

- explicitly scopes all application policies to `TO authenticated`;
- replaces row-by-row `auth.uid()` calls with `(select auth.uid())`;
- consolidates the owner/reviewer SELECT paths on:
  - `projects`
  - `project_roadmaps`
  - `milestones`
  - `milestone_submissions`
  - `milestone_submission_evaluations`
  - `milestone_reviews`
  - `project_reviewers`
- splits former `FOR ALL` policies by command only where necessary to avoid
  overlapping SELECT policies while preserving owner writes;
- preserves the union of owner and active-reviewer read access;
- explicitly qualifies the outer `project_id` in the work-session and deadline
  extension milestone checks.

That final qualification fixes a defect visible in the live policy deparse:
both policies had become `m.project_id = m.project_id`, which is always true.
The corrected expression compares the milestone's project to the outer row's
project. User ownership was still checked separately, so this was defense in
depth rather than evidence of cross-user access.

### Foreign-key indexes

Migration:
`20260726012309_add_advisor_foreign_key_indexes.sql`

All 21 live findings receive a referencing-side B-tree index. These keys are
used by direct application filters/joins, RLS ownership paths, or parent-row
referential actions:

| Table | Foreign-key column(s) indexed |
| --- | --- |
| `deadline_extension_events` | `milestone_id`, `project_id` |
| `generation_feedback` | `closest_recommendation_id`, `milestone_guidance_id`, `milestone_id`, `normalized_profile_id`, `project_id`, `roadmap_id`, `submission_evaluation_id` |
| `google_calendar_sync_events` | `project_id` |
| `google_calendar_sync_settings` | `integration_id` |
| `milestone_reviews` | `reviewer_user_id`, `submission_id` |
| `normalized_profiles` | `intake_id` |
| `portfolio_entries` | `featured_submission_id` |
| `project_invitations` | `accepted_by_user_id` |
| `project_recommendations` | `intake_id`, `normalized_profile_id` |
| `project_reviewers` | `invited_by_user_id` |
| `project_work_sessions` | `milestone_id` |
| `projects` | `recommendation_id` |

Existing wider indexes were not considered covering when the foreign-key
column was not the leftmost column. Full indexes, rather than partial indexes,
are used so the advisor and PostgreSQL referential-integrity checks can
unambiguously use them.

## SECURITY DEFINER RPC review

Live state before the local migration:

- function:
  `public.create_milestone_submission_with_pending_evaluation(uuid,text,text,text)`;
- owner: `postgres`;
- `SECURITY DEFINER`;
- fixed empty `search_path`;
- executable by `authenticated`, but not by `anon` or `service_role`;
- rejects a null `auth.uid()`;
- verifies `milestones -> projects.user_id = auth.uid()` before either write;
- atomically inserts one submission and one pending evaluation.

The body therefore already had the essential ownership guard. The advisor is a
valid hardening warning because the public Data API endpoint still ran with the
owner's privileges.

The local migration uses `ALTER FUNCTION ... SET SCHEMA private` to retain the
same privileged implementation and transaction. It creates a public
`SECURITY INVOKER` wrapper with the unchanged signature and return shape, then
grants only `authenticated` the required execute permissions. The private
schema is not in the Data API's exposed-schema list. This removes the public
SECURITY DEFINER endpoint without changing the existing `supabase-js` RPC call
or its atomic behavior.

The private implementation remains `SECURITY DEFINER` because direct inserts
into the append-only submission/evaluation tables are intentionally unavailable
to user roles. Its empty `search_path`, `auth.uid()` check, and milestone-owner
join remain intact.

## Expected no-policy findings

`public.auth_rate_limits` is intentionally service-role-only:

- RLS is enabled;
- policy count is zero;
- `anon` has no DML privileges;
- `authenticated` has no DML privileges;
- `service_role` has all required DML privileges.

Adding a user policy would expand access and defeat the table's purpose. The
`rls_enabled_no_policy` information notice is expected and should remain
documented rather than "fixed."

The fresh security advisor also reports the same expected pattern for
`private.rate_limit_reservations`, introduced by the atomic quota migration.
Its ACL likewise grants DML only to `service_role`. It is unexposed and has no
user policies by design.

## Unused-index candidates: no drops

The live advisor currently lists these 16 indexes:

1. `idx_normalized_profiles_user_intake`
2. `idx_milestone_submissions_user_created`
3. `idx_submission_evaluations_submission_created`
4. `idx_submission_evaluations_user_created`
5. `idx_generation_feedback_track_project_created`
6. `idx_project_invitations_project_status`
7. `idx_project_reviewers_reviewer_active`
8. `idx_milestone_reviews_milestone_created`
9. `idx_portfolio_exports_user_created`
10. `idx_google_calendar_sync_events_project`
11. `idx_portfolio_public_pages_user_created`
12. `idx_deadline_extension_events_item`
13. `idx_auth_rate_limits_bucket_key_created`
14. `rate_limit_reservations_active_lookup_idx`
15. `rate_limit_reservations_retention_idx`
16. `idx_projects_user_archive_status`

No index is dropped. Every listed index has `idx_scan = 0`, but the relevant
application tables currently have zero estimated live rows except
`normalized_profiles` with one. Candidate index sizes are only 8–16 KiB.
`pg_stat_database.stats_reset` is null, so there is no precise reset timestamp
with which to define a representative observation window. Several notices are
also for features/migrations deployed only recently.

Revisit candidates only after representative production traffic and table
growth (for example, 30–90 days), using `pg_stat_user_indexes`,
`pg_stat_statements`, query plans, and the corresponding application query
paths. Resetting statistics merely to justify a drop is not recommended.

## Advisor-after projection

This is a projection because the prepared migrations were not applied to
production.

| Finding | Before | After local migrations | After approved Auth toggle |
| --- | ---: | ---: | ---: |
| `auth_rls_initplan` | 31 | 0 | 0 |
| Multiple permissive policies | 42 | 0 | 0 |
| Unindexed foreign keys | 21 | 0 | 0 |
| Authenticated public SECURITY DEFINER RPC | 1 | 0 | 0 |
| Leaked-password protection disabled | 1 | 1 | 0 |
| Expected RLS/no-policy notices | 2 | 2 | 2 |
| Existing unused-index notices | 16 | 16 retained | 16 retained |

The unused-index total is workload-dependent. Immediately after deployment,
up to all 21 new foreign-key indexes may also be reported as unused until real
queries or referential actions exercise them. A no-traffic upper bound is
therefore 37 unused-index notices. That does not conflict with the missing-FK
fix; the two lints answer different questions.

## Leaked-password protection: production action requiring approval

Do not make this change as part of a SQL migration.

Exact hosted-dashboard procedure from the current Auth settings path:

1. Open the production project in the Supabase Dashboard.
2. Go to **Authentication → Providers → Email** (the current direct settings
   route is `/auth/providers?provider=Email`).
3. In **Password security**, enable **Prevent use of leaked passwords**.
4. Save the Email provider/Auth settings.
5. Re-run the Security Advisor and confirm
   `auth_leaked_password_protection` is gone.

This feature requires the **Pro plan or above**. If the control is unavailable,
confirm the organization/project plan before attempting the change. Enabling it
affects new password choices and password changes; it does not rewrite stored
password hashes.

## Migration drift and branch-safe deployment

### Fresh drift snapshot

`origin/master` does not contain the five develop migrations beginning at
`20260725090000`. The live production migration history now contains four of
them:

- `20260725090000_auth_rate_limits`
- `20260725093000_profile_student_stage_source_of_truth`
- `20260726000956_atomic_quota_reservations`
- `20260726003700_atomic_project_selection_and_archive_lifecycle`

Production does not yet contain:

- `20260726005923_claim_first_time_portfolio_curations`
- `20260726012305_harden_rls_and_submission_rpc`
- `20260726012309_add_advisor_foreign_key_indexes`

Production is therefore four migrations ahead of `master`, while local
`develop` is three migrations ahead of production after this review.

Do not delete, rename, squash, or migration-repair the four versions already in
production. Their exact migration files need to reach `master` so source
history again describes the deployed schema.

### Recommended process

1. In the Supabase GitHub integration, designate only `master` as the
   production branch. Disable any production deployment trigger from
   `develop`.
2. Give `develop` a persistent Supabase branch, or use per-PR preview branches.
   Preview deployments must use the branch project's credentials, never the
   production project ref or production database password.
3. Protect `master`: PR-only changes, required Supabase migration check, and
   required application tests/build.
4. First reconcile drift by merging the exact four already-applied migration
   files and their dependent code into `master`. Do not push those versions
   again; the production migration table will recognize them as applied.
5. In preview/local CI, rebuild from zero with `supabase db reset`, run
   `supabase test db`, run `supabase db lint`, and run local advisors.
6. Permit a production job only for a reviewed `master` commit and protect it
   with the production environment approval gate. Preflight with:

   ```sh
   supabase migration list --linked
   supabase db push --linked --dry-run
   ```

   The dry run must show only the migration versions reviewed in that exact
   `master` commit.
7. Apply with `supabase db push --linked` only after approval, then re-run both
   advisor categories and smoke-test owner/reviewer access plus the submission
   RPC.
8. Never run `supabase db reset --linked`. Avoid keeping a developer workspace
   linked to production by default; require an explicit production profile/ref
   only inside the protected deployment job.

Supabase Branching requires Pro. Without it, use the local database for PR
validation and retain the same protected, master-only production job.

## Production actions still requiring separate approval

- Apply the three production-pending migrations listed above.
- Enable leaked-password protection in the Auth dashboard.
- Change the Supabase GitHub integration/branch mapping or CI production
  credentials.
- Drop any unused index after a later workload review.

None of these actions was performed during this review.
