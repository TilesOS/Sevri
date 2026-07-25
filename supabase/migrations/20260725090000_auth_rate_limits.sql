-- Rate-limit ledger for auth requests that arrive before we know who is asking.
--
-- `usage_events` cannot hold these: its user_id is NOT NULL and references
-- auth.users, while a password-recovery request is anonymous by definition (and
-- must stay anonymous — confirming which addresses have accounts would leak
-- account existence). Keys are stored as SHA-256 digests so this table never
-- becomes a readable list of email addresses or IPs.
--
-- Additive and reversible: creates one new table and touches no existing rows.
-- Reverse with `drop table if exists public.auth_rate_limits;`.

create table if not exists public.auth_rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_rate_limits_bucket_key_created
  on public.auth_rate_limits(bucket, key_hash, created_at desc);

-- Service-role only. RLS enabled with no policies means anon and authenticated
-- clients can neither read nor write; only the admin client reaches this table.
alter table public.auth_rate_limits enable row level security;
