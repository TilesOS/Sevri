# Atomic rate limits and quota reservations

Sevri's cost and operational limits use database reservations rather than an
application-side count followed by an insert. The implementation is introduced
by `20260726000956_atomic_quota_reservations.sql`.

## Concurrency model

Each claim calls a service-role-only Postgres RPC. The RPC takes a
transaction-scoped advisory lock derived from the bucket and opaque key digest,
counts active rows, and inserts a reservation while it still holds that lock.
Claims for different users or buckets proceed independently; claims for the
same key serialize. Consequently, parallel requests at the boundary cannot
collect more successful reservations than the configured limit.

Password recovery locks the IP and email digests in deterministic order, checks
the IP first, and inserts both reservations only if both limits allow the
request. A blocked IP cannot consume an email-address slot.

The free recommendation entitlement uses the same key serialization. Its RPC
counts durable recommendation batches plus unexpired in-flight reservations.
Only a request holding an entitlement reservation may start the normalization
and options model pipeline.

## Failure and availability policy

Cost-bearing routes fail closed when the reservation database is unavailable.
This intentionally trades temporary generation/export/email availability for a
hard ceiling on uncontrolled OpenAI, Resend, and external API usage.

A reservation is consumed after the operation produces and stores a usable
result. Provider/model failures, validation failures, missing resources, and
email-send failures release their reservations, so they do not consume the
user's rolling limit or free-generation entitlement. A portfolio result rejected
by the post-generation safety check does consume its operational slot because
the model call completed. Cached successful GitHub activity responses also
consume the request limit, matching the previous endpoint semantics.

Recommendation entitlements are durable through the persisted batch, not the
reservation row. If persistence succeeds but finalization is interrupted, the
next claim still sees the batch and cannot over-grant.

## Stale work, reset times, and retention

General and AI reservations expire after 30 minutes; password-recovery
reservations expire after 5 minutes. Expired reservations no longer count and
are marked released by the next claim. Denied claims return the earliest time a
slot can become available, and application responses expose `reset_at` plus an
HTTP `Retry-After` header.

Rows remain for one day after they stop affecting a limit. Every claim performs
an indexed retention delete, so cleanup does not depend on `pg_cron`. The ledger
is in the unexposed `private` schema, has RLS enabled, explicitly revokes browser
roles, and grants access only to `service_role`. Emails, IP addresses, and user
identifiers are stored only as namespaced SHA-256 digests.

## Verification

- `npm run test:unit` covers key normalization and namespace separation.
- `npm run test:db:rate-limits` issues concurrent RPC calls against a local
  Supabase stack configured with `SUPABASE_TEST_URL`,
  `SUPABASE_TEST_SERVICE_ROLE_KEY`, and optionally `SUPABASE_TEST_ANON_KEY`.
- `supabase test db supabase/tests/database/rate_limit_reservations.test.sql`
  checks indexes and browser/service-role privileges.

The integration suite asserts exact grants under parallel load, immediate reuse
after release, stale-reservation recovery, the IP-before-email recovery
behavior, and denied browser RPC access. Never run these tests against the live
project.
