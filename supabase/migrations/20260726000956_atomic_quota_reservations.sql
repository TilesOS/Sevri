-- Atomic, service-role-only reservations for application rate limits and quotas.
--
-- Concurrency model:
--   * every claim takes a transaction-scoped advisory lock derived from its
--     bucket + opaque key hash;
--   * the active-count check and reservation insert happen while that lock is
--     held, so parallel transactions for the same key serialize;
--   * successful work marks a reservation consumed, failed work releases it,
--     and abandoned reservations stop counting at expires_at.
--
-- The ledger lives in the unexposed private schema. Public RPC wrappers use
-- SECURITY INVOKER and are executable only by service_role.

create schema if not exists private;
grant usage on schema private to service_role;

create table private.rate_limit_reservations (
  id uuid primary key default gen_random_uuid(),
  bucket text not null check (length(bucket) between 1 and 240),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'reserved'
    check (status in ('reserved', 'consumed', 'released')),
  window_seconds integer not null check (window_seconds > 0),
  claimed_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  released_at timestamptz,
  resource_id uuid,
  retain_until timestamptz not null,
  constraint rate_limit_reservations_expiry_after_claim
    check (expires_at > claimed_at),
  constraint rate_limit_reservations_status_timestamps
    check (
      (status = 'reserved' and consumed_at is null and released_at is null)
      or (status = 'consumed' and consumed_at is not null and released_at is null)
      or (status = 'released' and consumed_at is null and released_at is not null)
    )
);

create index rate_limit_reservations_active_lookup_idx
  on private.rate_limit_reservations (bucket, key_hash, claimed_at)
  where status in ('reserved', 'consumed');

create index rate_limit_reservations_retention_idx
  on private.rate_limit_reservations (retain_until);

alter table private.rate_limit_reservations enable row level security;
revoke all on private.rate_limit_reservations from public, anon, authenticated;
grant select, insert, update, delete on private.rate_limit_reservations to service_role;

create or replace function public.claim_rate_limit_reservation(
  p_bucket text,
  p_key_hash text,
  p_max_requests integer,
  p_window_seconds integer,
  p_reservation_ttl_seconds integer default 1800
)
returns table (
  allowed boolean,
  reservation_id uuid,
  remaining integer,
  reset_at timestamptz,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_active_count integer;
  v_reservation_id uuid;
  v_reset_at timestamptz;
  v_new_slot_reset timestamptz;
begin
  if p_bucket is null or length(p_bucket) not between 1 and 240 then
    raise exception 'invalid rate-limit bucket' using errcode = '22023';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid rate-limit key hash' using errcode = '22023';
  end if;
  if p_max_requests <= 0 or p_window_seconds <= 0 or p_reservation_ttl_seconds <= 0 then
    raise exception 'rate-limit values must be positive' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sevri-rate-limit:' || p_bucket || ':' || p_key_hash, 0)
  );
  v_now := clock_timestamp();

  -- Retention is enforced opportunistically on every claim. The indexed delete
  -- keeps the table bounded even when pg_cron is unavailable locally.
  delete from private.rate_limit_reservations
  where retain_until <= v_now;

  update private.rate_limit_reservations
  set
    status = 'released',
    released_at = v_now,
    retain_until = v_now + interval '1 day'
  where bucket = p_bucket
    and key_hash = p_key_hash
    and status = 'reserved'
    and expires_at <= v_now;

  select
    count(*)::integer,
    min(
      case
        when r.status = 'reserved'
          then least(
            r.expires_at,
            r.claimed_at + pg_catalog.make_interval(secs => p_window_seconds)
          )
        else r.claimed_at + pg_catalog.make_interval(secs => p_window_seconds)
      end
    )
  into v_active_count, v_reset_at
  from private.rate_limit_reservations r
  where r.bucket = p_bucket
    and r.key_hash = p_key_hash
    and r.claimed_at >= v_now - pg_catalog.make_interval(secs => p_window_seconds)
    and (
      r.status = 'consumed'
      or (r.status = 'reserved' and r.expires_at > v_now)
    );

  if v_active_count >= p_max_requests then
    return query
    select
      false,
      null::uuid,
      0,
      v_reset_at,
      greatest(1, ceil(extract(epoch from (v_reset_at - v_now)))::integer);
    return;
  end if;

  insert into private.rate_limit_reservations (
    bucket,
    key_hash,
    window_seconds,
    claimed_at,
    expires_at,
    retain_until
  )
  values (
    p_bucket,
    p_key_hash,
    p_window_seconds,
    v_now,
    v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds),
    v_now
      + pg_catalog.make_interval(secs => p_reservation_ttl_seconds)
      + interval '1 day'
  )
  returning id into v_reservation_id;

  v_new_slot_reset := least(
    v_now + pg_catalog.make_interval(secs => p_window_seconds),
    v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds)
  );
  v_reset_at := least(coalesce(v_reset_at, v_new_slot_reset), v_new_slot_reset);

  return query
  select
    true,
    v_reservation_id,
    greatest(p_max_requests - v_active_count - 1, 0),
    v_reset_at,
    0;
end;
$$;

create or replace function public.finalize_rate_limit_reservation(
  p_reservation_id uuid,
  p_consume boolean,
  p_resource_id uuid default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_bucket text;
  v_key_hash text;
  v_now timestamptz;
begin
  select r.bucket, r.key_hash
  into v_bucket, v_key_hash
  from private.rate_limit_reservations r
  where r.id = p_reservation_id;

  if v_bucket is null then
    return false;
  end if;

  -- Use the same key lock as claims so a release immediately frees capacity
  -- for the next transaction instead of racing a concurrent count.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sevri-rate-limit:' || v_bucket || ':' || v_key_hash, 0)
  );
  v_now := clock_timestamp();

  if p_consume then
    update private.rate_limit_reservations
    set
      status = 'consumed',
      consumed_at = v_now,
      resource_id = p_resource_id,
      retain_until = claimed_at
        + pg_catalog.make_interval(secs => window_seconds)
        + interval '1 day'
    where id = p_reservation_id
      and status = 'reserved'
      and expires_at > v_now;
  else
    update private.rate_limit_reservations
    set
      status = 'released',
      released_at = v_now,
      retain_until = v_now + interval '1 day'
    where id = p_reservation_id
      and status = 'reserved';
  end if;

  return found;
end;
$$;

create or replace function public.claim_password_recovery_reservations(
  p_ip_key_hash text,
  p_email_key_hash text,
  p_ip_max_requests integer,
  p_email_max_requests integer,
  p_ip_window_seconds integer,
  p_email_window_seconds integer,
  p_reservation_ttl_seconds integer default 300
)
returns table (
  allowed boolean,
  blocked_bucket text,
  ip_reservation_id uuid,
  email_reservation_id uuid,
  ip_remaining integer,
  email_remaining integer,
  reset_at timestamptz,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_ip_bucket constant text := 'password_recovery_ip';
  v_email_bucket constant text := 'password_recovery_email';
  v_ip_lock bigint;
  v_email_lock bigint;
  v_ip_count integer;
  v_email_count integer;
  v_ip_reset timestamptz;
  v_email_reset timestamptz;
  v_ip_reservation_id uuid;
  v_email_reservation_id uuid;
begin
  if p_ip_key_hash is null or p_ip_key_hash !~ '^[0-9a-f]{64}$'
    or p_email_key_hash is null or p_email_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid auth rate-limit key hash' using errcode = '22023';
  end if;
  if p_ip_max_requests <= 0 or p_email_max_requests <= 0
    or p_ip_window_seconds <= 0 or p_email_window_seconds <= 0
    or p_reservation_ttl_seconds <= 0 then
    raise exception 'auth rate-limit values must be positive' using errcode = '22023';
  end if;

  v_ip_lock := pg_catalog.hashtextextended(
    'sevri-rate-limit:' || v_ip_bucket || ':' || p_ip_key_hash,
    0
  );
  v_email_lock := pg_catalog.hashtextextended(
    'sevri-rate-limit:' || v_email_bucket || ':' || p_email_key_hash,
    0
  );

  -- Two keys are locked in numeric order to prevent deadlocks when different
  -- requests happen to share an IP and email in opposite combinations.
  perform pg_catalog.pg_advisory_xact_lock(least(v_ip_lock, v_email_lock));
  if v_ip_lock <> v_email_lock then
    perform pg_catalog.pg_advisory_xact_lock(greatest(v_ip_lock, v_email_lock));
  end if;
  v_now := clock_timestamp();

  delete from private.rate_limit_reservations
  where retain_until <= v_now;

  update private.rate_limit_reservations
  set
    status = 'released',
    released_at = v_now,
    retain_until = v_now + interval '1 day'
  where status = 'reserved'
    and expires_at <= v_now
    and (
      (bucket = v_ip_bucket and key_hash = p_ip_key_hash)
      or (bucket = v_email_bucket and key_hash = p_email_key_hash)
    );

  -- Check the IP first. If it is blocked, the email key is never consumed.
  select
    count(*)::integer,
    min(
      case
        when r.status = 'reserved'
          then least(
            r.expires_at,
            r.claimed_at + pg_catalog.make_interval(secs => p_ip_window_seconds)
          )
        else r.claimed_at + pg_catalog.make_interval(secs => p_ip_window_seconds)
      end
    )
  into v_ip_count, v_ip_reset
  from private.rate_limit_reservations r
  where r.bucket = v_ip_bucket
    and r.key_hash = p_ip_key_hash
    and r.claimed_at >= v_now - pg_catalog.make_interval(secs => p_ip_window_seconds)
    and (
      r.status = 'consumed'
      or (r.status = 'reserved' and r.expires_at > v_now)
    );

  if v_ip_count >= p_ip_max_requests then
    return query
    select
      false,
      'ip'::text,
      null::uuid,
      null::uuid,
      0,
      null::integer,
      v_ip_reset,
      greatest(1, ceil(extract(epoch from (v_ip_reset - v_now)))::integer);
    return;
  end if;

  select
    count(*)::integer,
    min(
      case
        when r.status = 'reserved'
          then least(
            r.expires_at,
            r.claimed_at + pg_catalog.make_interval(secs => p_email_window_seconds)
          )
        else r.claimed_at + pg_catalog.make_interval(secs => p_email_window_seconds)
      end
    )
  into v_email_count, v_email_reset
  from private.rate_limit_reservations r
  where r.bucket = v_email_bucket
    and r.key_hash = p_email_key_hash
    and r.claimed_at >= v_now - pg_catalog.make_interval(secs => p_email_window_seconds)
    and (
      r.status = 'consumed'
      or (r.status = 'reserved' and r.expires_at > v_now)
    );

  if v_email_count >= p_email_max_requests then
    return query
    select
      false,
      'email'::text,
      null::uuid,
      null::uuid,
      (p_ip_max_requests - v_ip_count)::integer,
      0,
      v_email_reset,
      greatest(1, ceil(extract(epoch from (v_email_reset - v_now)))::integer);
    return;
  end if;

  insert into private.rate_limit_reservations (
    bucket,
    key_hash,
    window_seconds,
    claimed_at,
    expires_at,
    retain_until
  )
  values (
    v_ip_bucket,
    p_ip_key_hash,
    p_ip_window_seconds,
    v_now,
    v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds),
    v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds) + interval '1 day'
  )
  returning id into v_ip_reservation_id;

  insert into private.rate_limit_reservations (
    bucket,
    key_hash,
    window_seconds,
    claimed_at,
    expires_at,
    retain_until
  )
  values (
    v_email_bucket,
    p_email_key_hash,
    p_email_window_seconds,
    v_now,
    v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds),
    v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds) + interval '1 day'
  )
  returning id into v_email_reservation_id;

  return query
  select
    true,
    null::text,
    v_ip_reservation_id,
    v_email_reservation_id,
    greatest(p_ip_max_requests - v_ip_count - 1, 0),
    greatest(p_email_max_requests - v_email_count - 1, 0),
    least(
      coalesce(
        v_ip_reset,
        least(
          v_now + pg_catalog.make_interval(secs => p_ip_window_seconds),
          v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds)
        )
      ),
      coalesce(
        v_email_reset,
        least(
          v_now + pg_catalog.make_interval(secs => p_email_window_seconds),
          v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds)
        )
      )
    ),
    0;
end;
$$;

create or replace function public.claim_recommendation_generation(
  p_user_id uuid,
  p_key_hash text,
  p_generation_limit integer,
  p_reservation_ttl_seconds integer default 1800
)
returns table (
  allowed boolean,
  reservation_id uuid,
  generations_used integer,
  remaining integer,
  reset_at timestamptz,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_bucket constant text := 'recommendation_generation_entitlement';
  v_actual_count integer;
  v_reserved_count integer;
  v_reservation_id uuid;
  v_reset_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'user id is required' using errcode = '22023';
  end if;
  if p_key_hash is null or p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid recommendation quota key hash' using errcode = '22023';
  end if;
  if p_generation_limit <= 0 or p_reservation_ttl_seconds <= 0 then
    raise exception 'recommendation quota values must be positive' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('sevri-rate-limit:' || v_bucket || ':' || p_key_hash, 0)
  );
  v_now := clock_timestamp();

  delete from private.rate_limit_reservations
  where retain_until <= v_now;

  update private.rate_limit_reservations
  set
    status = 'released',
    released_at = v_now,
    retain_until = v_now + interval '1 day'
  where bucket = v_bucket
    and key_hash = p_key_hash
    and status = 'reserved'
    and expires_at <= v_now;

  -- Persisted recommendation batches are the durable entitlement source of
  -- truth. Only in-flight reservations are added, so a successful finalized
  -- reservation is not double-counted after its recommendations are stored.
  select count(distinct pr.normalized_profile_id)::integer
  into v_actual_count
  from public.project_recommendations pr
  where pr.user_id = p_user_id
    and pr.normalized_profile_id is not null;

  select count(*)::integer, min(r.expires_at)
  into v_reserved_count, v_reset_at
  from private.rate_limit_reservations r
  where r.bucket = v_bucket
    and r.key_hash = p_key_hash
    and r.status = 'reserved'
    and r.expires_at > v_now;

  if v_actual_count + v_reserved_count >= p_generation_limit then
    return query
    select
      false,
      null::uuid,
      (v_actual_count + v_reserved_count)::integer,
      0,
      v_reset_at,
      case
        when v_reset_at is null then 0
        else greatest(1, ceil(extract(epoch from (v_reset_at - v_now)))::integer)
      end;
    return;
  end if;

  insert into private.rate_limit_reservations (
    bucket,
    key_hash,
    window_seconds,
    claimed_at,
    expires_at,
    retain_until
  )
  values (
    v_bucket,
    p_key_hash,
    1, -- consumed entitlement rows are superseded by durable recommendation batches
    v_now,
    v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds),
    v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds) + interval '1 day'
  )
  returning id into v_reservation_id;

  return query
  select
    true,
    v_reservation_id,
    (v_actual_count + v_reserved_count + 1)::integer,
    greatest(p_generation_limit - v_actual_count - v_reserved_count - 1, 0),
    v_now + pg_catalog.make_interval(secs => p_reservation_ttl_seconds),
    0;
end;
$$;

revoke all on function public.claim_rate_limit_reservation(text, text, integer, integer, integer)
from public, anon, authenticated;
grant execute on function public.claim_rate_limit_reservation(text, text, integer, integer, integer)
to service_role;

revoke all on function public.finalize_rate_limit_reservation(uuid, boolean, uuid)
from public, anon, authenticated;
grant execute on function public.finalize_rate_limit_reservation(uuid, boolean, uuid)
to service_role;

revoke all on function public.claim_password_recovery_reservations(
  text, text, integer, integer, integer, integer, integer
)
from public, anon, authenticated;
grant execute on function public.claim_password_recovery_reservations(
  text, text, integer, integer, integer, integer, integer
)
to service_role;

revoke all on function public.claim_recommendation_generation(uuid, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.claim_recommendation_generation(uuid, text, integer, integer)
to service_role;

-- Keep the superseded table for a rollback-safe deployment, but make its
-- service-only contract explicit and prune data outside its old maximum window.
alter table if exists public.auth_rate_limits enable row level security;
revoke all on table public.auth_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.auth_rate_limits to service_role;
delete from public.auth_rate_limits
where created_at < clock_timestamp() - interval '1 day';
