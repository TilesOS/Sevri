-- Preserve project lifecycle status independently from dashboard/calendar
-- visibility, and make recommendation selection a single atomic operation.

alter table public.projects
  add column archived_at timestamptz,
  add column selection_operation_id uuid not null default gen_random_uuid();

-- Legacy `archived` rows have already lost the status they held before archive.
-- There is no reliable data from which to distinguish active, paused, and
-- completed. Backfill them as active (the historical restore behavior) while
-- retaining the best available archive timestamp. This is intentionally the
-- only assumption made for irrecoverable legacy state.
update public.projects
set
  archived_at = coalesce(updated_at, selected_at, created_at, clock_timestamp()),
  status = 'active'
where status = 'archived';

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (status in ('active', 'paused', 'completed'));

alter table public.projects
  add constraint projects_user_selection_operation_key
  unique (user_id, selection_operation_id);

create index idx_projects_user_archive_status
  on public.projects (user_id, archived_at, status);

comment on column public.projects.archived_at is
  'Archive visibility marker. Project lifecycle status remains unchanged when this is set.';

comment on column public.projects.selection_operation_id is
  'Client-generated idempotency key for the recommendation selection operation.';

create or replace function public.select_project_from_recommendation(
  p_recommendation_id uuid,
  p_operation_id uuid,
  p_allow_duplicate boolean default false
)
returns table (
  project_id uuid,
  project_title text,
  project_track text,
  selection_outcome text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_recommendation public.project_recommendations%rowtype;
  v_project public.projects%rowtype;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_recommendation_id is null or p_operation_id is null then
    raise exception 'recommendation and operation IDs are required' using errcode = '22023';
  end if;

  -- Serialize every selection decision for a user/recommendation pair. The
  -- transaction-scoped lock covers both the existing-project decision and the
  -- insert, including calls carrying different operation IDs from other tabs.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'sevri-project-selection:' || v_user_id::text || ':' || p_recommendation_id::text,
      0
    )
  );

  -- Operation identity wins over all later request flags. A retry returns the
  -- exact project created by the original call, even if it was since archived.
  select p.*
  into v_project
  from public.projects p
  where p.user_id = v_user_id
    and p.selection_operation_id = p_operation_id;

  if found then
    if v_project.recommendation_id <> p_recommendation_id then
      raise exception 'operation ID was already used for another recommendation'
        using errcode = '22023';
    end if;

    return query
    select
      v_project.id,
      v_project.title,
      v_project.project_track,
      'replayed'::text;
    return;
  end if;

  -- Keep authorization and ownership validation inside the atomic operation.
  -- RLS remains active because this function is SECURITY INVOKER.
  select r.*
  into v_recommendation
  from public.project_recommendations r
  where r.id = p_recommendation_id
    and r.user_id = v_user_id;

  if not found then
    raise exception 'recommendation not found' using errcode = 'P0002';
  end if;

  if not p_allow_duplicate then
    select p.*
    into v_project
    from public.projects p
    where p.user_id = v_user_id
      and p.recommendation_id = p_recommendation_id
      and p.archived_at is null
    order by p.selected_at asc, p.id asc
    limit 1;

    if found then
      return query
      select
        v_project.id,
        v_project.title,
        v_project.project_track,
        'duplicate'::text;
      return;
    end if;
  end if;

  insert into public.projects (
    user_id,
    recommendation_id,
    selection_operation_id,
    project_track,
    title,
    status
  )
  values (
    v_user_id,
    v_recommendation.id,
    p_operation_id,
    case when v_recommendation.project_track = 'research' then 'research' else 'software' end,
    v_recommendation.title,
    'active'
  )
  returning * into v_project;

  return query
  select
    v_project.id,
    v_project.title,
    v_project.project_track,
    'created'::text;
end;
$$;

revoke all on function public.select_project_from_recommendation(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.select_project_from_recommendation(uuid, uuid, boolean)
  to authenticated;
