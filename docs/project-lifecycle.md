# Project selection and archive lifecycle

Migration `20260726003700_atomic_project_selection_and_archive_lifecycle.sql`
separates lifecycle status from archive visibility and makes recommendation
selection idempotent.

## Archive backfill

New records keep `status` as `active`, `paused`, or `completed`; archiving sets
`archived_at`, and restoring clears it. Dashboard and calendar queries require
`archived_at is null`. Portfolio intentionally retains archived records and
shows them as Cut while the underlying lifecycle status remains unchanged.
Workspace pages and focus blocks also retain archived records, including focus
session completion; archiving hides planning surfaces without disabling work in
an explicitly opened project.

Legacy rows whose `status` is already `archived` cannot be restored to their
original state because that value was overwritten before this migration. The
migration makes the unavoidable assumption that every such row was `active`,
matching the application's historical restore behavior, and uses the row's
previous `updated_at` (falling back to `selected_at` or `created_at`) as the best
available `archived_at` timestamp. No inference can reliably recover whether a
legacy row was paused or completed.

## Selection operations

The client sends a UUID `operation_id`. The database stores it as
`projects.selection_operation_id` under a per-user unique constraint. The
selection RPC holds a transaction-scoped lock for the user/recommendation pair,
checks recommendation ownership under RLS, and performs the duplicate decision
and insert in the same transaction.

- Replaying an operation returns its original project.
- Concurrent unconfirmed operations serialize and produce at most one project.
- A confirmed duplicate uses a new operation ID and may create another project.
- Archived projects do not block a new default selection.

Apply the migration before deploying the application code that calls
`select_project_from_recommendation`. Validate locally with `supabase db lint
--local` and `supabase test db`. Do not apply this migration to production as
part of local validation.
