-- Move first-time Portfolio curation out of page reads. A short-lived database
-- claim makes the explicit post-render mutation safe across retries, tabs, and
-- concurrent application instances.

alter table public.portfolio_entries
  add column curation_claim_token uuid,
  add column curation_claimed_at timestamptz;

create index idx_portfolio_entries_first_curation_claim
  on public.portfolio_entries (user_id, curation_claimed_at, curation_attempted_at)
  where curated_summary is null;

create or replace function public.claim_first_time_portfolio_curations(
  p_project_id uuid default null,
  p_limit integer default 3
)
returns table (
  entry_id uuid,
  project_id uuid,
  claim_token uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(p_limit, 3), 3));
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Entry initialization is part of this authenticated mutation, never a GET.
  insert into public.portfolio_entries (user_id, project_id)
  select v_user_id, p.id
  from public.projects p
  where p.user_id = v_user_id
    and (p_project_id is null or p.id = p_project_id)
  on conflict on constraint portfolio_entries_project_id_key do nothing;

  return query
  with candidates as (
    select pe.id
    from public.portfolio_entries pe
    where pe.user_id = v_user_id
      and (p_project_id is null or pe.project_id = p_project_id)
      and coalesce(pg_catalog.btrim(pe.curated_summary), '') = ''
      and coalesce(pe.curation_metadata_json ->> 'blocked', 'false') <> 'true'
      and (
        pe.curation_attempted_at is null
        or pe.curation_attempted_at <= pg_catalog.clock_timestamp() - interval '1 hour'
      )
      and (
        pe.curation_claimed_at is null
        or pe.curation_claimed_at <= pg_catalog.clock_timestamp() - interval '15 minutes'
      )
    order by pe.created_at asc, pe.id asc
    limit v_limit
    for update skip locked
  )
  update public.portfolio_entries pe
  set
    curation_claim_token = gen_random_uuid(),
    curation_claimed_at = pg_catalog.clock_timestamp()
  from candidates
  where pe.id = candidates.id
  returning pe.id, pe.project_id, pe.curation_claim_token;
end;
$$;

revoke all on function public.claim_first_time_portfolio_curations(uuid, integer)
  from public, anon;
grant execute on function public.claim_first_time_portfolio_curations(uuid, integer)
  to authenticated;

comment on function public.claim_first_time_portfolio_curations(uuid, integer) is
  'Authenticates, initializes missing owned Portfolio entries, and atomically claims eligible first-time curation work.';
