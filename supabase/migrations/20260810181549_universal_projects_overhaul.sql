-- Universal projects clean-cut migration.
--
-- This migration intentionally removes incompatible project-era data while
-- preserving auth identities, subscriptions, account profiles, integrations,
-- and email preferences. Production operators must explicitly acknowledge any
-- existing projects before applying it:
--   comment on table public.projects is 'sevri:authorize:20260810181549';

do $$
begin
  if exists (select 1 from public.projects limit 1)
    and coalesce(obj_description('public.projects'::regclass, 'pg_class'), '')
      <> 'sevri:authorize:20260810181549'
  then
    raise exception using
      errcode = '55000',
      message = 'Universal projects preflight found existing project data.',
      hint = 'Audit and back up the project rows, then authorize this exact migration with COMMENT ON TABLE public.projects IS ''sevri:authorize:20260810181549''.';
  end if;
end
$$;

-- Consume the one-time authorization marker in the migration transaction.
comment on table public.projects is null;

-- Reporting views and the atomic selector still reference legacy track
-- columns. Drop them explicitly so the column changes remain restrictive
-- (without CASCADE), then recreate their universal equivalents below.
drop view if exists private.impact_summary;
drop view if exists private.weekly_progress_cohorts;
drop view if exists private.user_progress_funnel;
drop view if exists private.project_progress_report;
drop function if exists public.select_project_from_recommendation(uuid, uuid, boolean);

-- Project-owned rows cascade through roadmaps, milestones, submissions,
-- reviews, portfolio entries, calendar links, GitHub links, and invitations.
delete from public.projects;
delete from public.project_recommendations;
delete from public.normalized_profiles;
delete from public.intakes;
delete from public.generation_feedback;

-- Account identity remains; project-purpose fields are reset for the new
-- intake. Reviewer profiles may legitimately leave project_goal null.
alter table public.profiles
  drop constraint if exists profiles_project_track_check,
  drop column if exists project_track,
  drop column if exists target_outcome,
  add column if not exists project_goal text;

alter table public.profiles
  add constraint profiles_project_goal_check
  check (
    project_goal is null or project_goal in (
      'learning', 'portfolio', 'college_applications', 'internship_or_job',
      'class_or_capstone', 'competition', 'community_impact', 'personal', 'other'
    )
  );

alter table public.intakes
  drop constraint if exists intakes_project_track_check,
  drop column if exists project_track,
  drop column if exists track_payload_json,
  drop column if exists coding_experience,
  drop column if exists preferred_project_style,
  drop column if exists known_tools,
  drop column if exists target_schools_or_companies,
  drop column if exists preferred_difficulty,
  drop column if exists constraints,
  add column project_goal text not null,
  add column success_definition text not null,
  add column open_to_anything boolean not null default true,
  add column format_preferences text[] not null default '{}',
  add column preference_notes text,
  add column experience_level text not null,
  add column existing_skills text[] not null default '{}',
  add column available_resources text,
  add column completion_date date,
  add column budget_constraints text,
  add column preferred_challenge text not null default 'intermediate',
  add column other_constraints text;

alter table public.intakes
  add constraint intakes_project_goal_check check (project_goal in (
    'learning', 'portfolio', 'college_applications', 'internship_or_job',
    'class_or_capstone', 'competition', 'community_impact', 'personal', 'other'
  )),
  add constraint intakes_experience_level_check check (experience_level in ('beginner', 'intermediate', 'advanced')),
  add constraint intakes_preferred_challenge_check check (preferred_challenge in ('beginner', 'intermediate', 'advanced')),
  add constraint intakes_format_preferences_check check (
    format_preferences <@ array['physical','digital','investigative','creative','community','venture']::text[]
  ),
  add constraint intakes_format_choice_check check (open_to_anything or cardinality(format_preferences) > 0);

alter table public.normalized_profiles
  drop constraint if exists normalized_profiles_project_track_check,
  drop column if exists project_track,
  drop column if exists track_payload_json,
  add column project_context_json jsonb not null default '{}'::jsonb;

alter table public.project_recommendations
  drop constraint if exists project_recommendations_project_track_check,
  drop column if exists project_track,
  drop column if exists track_payload_json,
  add column project_kind_label text not null,
  add column repository_relevance text not null default 'optional',
  add column project_blueprint_json jsonb not null default '{}'::jsonb,
  add column grounding_sources_json jsonb not null default '[]'::jsonb;

alter table public.project_recommendations
  add constraint project_recommendations_repository_relevance_check
  check (repository_relevance in ('recommended', 'optional', 'not_needed'));

alter table public.projects
  drop constraint if exists projects_project_track_check,
  drop column if exists project_track,
  add column project_kind_label text not null,
  add column repository_relevance text not null default 'optional';

alter table public.projects
  add constraint projects_repository_relevance_check
  check (repository_relevance in ('recommended', 'optional', 'not_needed'));

alter table public.project_roadmaps
  drop constraint if exists project_roadmaps_project_track_check,
  drop column if exists project_track;

alter table public.project_roadmaps
  rename column mvp_scope to core_scope;

alter table public.project_roadmaps
  rename column repo_structure to artifact_plan;

alter table public.project_roadmaps
  rename column readme_draft to project_overview_draft;

alter table public.project_roadmaps
  rename column track_payload_json to roadmap_context_json;

alter table public.generation_feedback
  drop constraint if exists generation_feedback_project_track_check,
  drop column if exists project_track;

drop index if exists public.idx_generation_feedback_track_project_created;
drop index if exists public.idx_generation_feedback_context;
create index idx_generation_feedback_project_created
  on public.generation_feedback(project_id, created_at desc)
  where project_id is not null;

-- Atomic selection copies the descriptive kind and repository recommendation
-- without turning either into a feature gate.
create function public.select_project_from_recommendation(
  p_recommendation_id uuid,
  p_operation_id uuid,
  p_allow_duplicate boolean default false
)
returns table (
  project_id uuid,
  project_title text,
  project_kind_label text,
  repository_relevance text,
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'sevri-project-selection:' || v_user_id::text || ':' || p_recommendation_id::text,
      0
    )
  );

  select p.* into v_project
  from public.projects p
  where p.user_id = v_user_id and p.selection_operation_id = p_operation_id;

  if found then
    if v_project.recommendation_id <> p_recommendation_id then
      raise exception 'operation ID was already used for another recommendation' using errcode = '22023';
    end if;
    return query select v_project.id, v_project.title, v_project.project_kind_label,
      v_project.repository_relevance, 'replayed'::text;
    return;
  end if;

  select r.* into v_recommendation
  from public.project_recommendations r
  where r.id = p_recommendation_id and r.user_id = v_user_id;
  if not found then
    raise exception 'recommendation not found' using errcode = 'P0002';
  end if;

  if not p_allow_duplicate then
    select p.* into v_project
    from public.projects p
    where p.user_id = v_user_id
      and p.recommendation_id = p_recommendation_id
      and p.archived_at is null
    order by p.selected_at asc, p.id asc
    limit 1;
    if found then
      return query select v_project.id, v_project.title, v_project.project_kind_label,
        v_project.repository_relevance, 'duplicate'::text;
      return;
    end if;
  end if;

  insert into public.projects (
    user_id, recommendation_id, selection_operation_id, title, status,
    project_kind_label, repository_relevance
  ) values (
    v_user_id, v_recommendation.id, p_operation_id, v_recommendation.title, 'active',
    v_recommendation.project_kind_label, v_recommendation.repository_relevance
  ) returning * into v_project;

  return query select v_project.id, v_project.title, v_project.project_kind_label,
    v_project.repository_relevance, 'created'::text;
end;
$$;

revoke all on function public.select_project_from_recommendation(uuid, uuid, boolean) from public, anon;
grant execute on function public.select_project_from_recommendation(uuid, uuid, boolean) to authenticated;

-- Keep founder reporting aligned with the universal intake and project model.
create view private.user_progress_funnel as
with student_users as (
  select
    u.id as user_id,
    u.email as user_email,
    u.created_at as user_created_at,
    p.full_name,
    p.user_role
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where coalesce(p.user_role, 'student') = 'student'
),
intake_rollup as (
  select
    user_id,
    min(created_at) as onboarding_completed_at,
    count(*)::int as intake_count,
    array_agg(distinct project_goal order by project_goal) as project_goals_started
  from public.intakes
  group by user_id
),
recommendation_rollup as (
  select
    user_id,
    min(created_at) as first_recommendations_generated_at,
    count(*)::int as recommendation_count,
    count(distinct normalized_profile_id)::int as recommendation_batch_count
  from public.project_recommendations
  group by user_id
),
project_rollup as (
  select
    user_id,
    min(selected_at) as first_project_selected_at,
    count(*)::int as project_count,
    count(*) filter (where status in ('active', 'paused'))::int as active_project_count,
    count(*) filter (where status = 'completed')::int as completed_status_project_count
  from public.projects
  group by user_id
),
roadmap_rollup as (
  select
    p.user_id,
    min(r.created_at) as first_roadmap_generated_at,
    count(r.id)::int as roadmap_count
  from public.projects p
  join public.project_roadmaps r on r.project_id = p.id
  group by p.user_id
),
milestone_rollup as (
  select
    p.user_id,
    min(m.completed_at) filter (where m.completed_at is not null) as first_milestone_completed_at,
    count(m.id)::int as total_milestone_count,
    count(m.id) filter (where m.completed)::int as completed_milestone_count
  from public.projects p
  join public.milestones m on m.project_id = p.id
  group by p.user_id
),
project_completion as (
  select
    p.user_id,
    p.id as project_id,
    count(m.id)::int as total_milestones,
    count(m.id) filter (where m.completed)::int as completed_milestones,
    max(m.completed_at) filter (where m.completed_at is not null) as shipped_at
  from public.projects p
  left join public.milestones m on m.project_id = p.id
  group by p.user_id, p.id
),
shipped_rollup as (
  select
    user_id,
    min(shipped_at) as first_project_shipped_at,
    count(*)::int as shipped_project_count
  from project_completion
  where total_milestones > 0
    and completed_milestones = total_milestones
  group by user_id
),
event_rollup as (
  select
    user_id,
    min(created_at) filter (where event_type = 'onboarding_completed') as first_onboarding_event_at,
    min(created_at) filter (where event_type = 'recommendations_generated') as first_recommendations_event_at,
    min(created_at) filter (where event_type = 'recommendation_selected') as first_selection_event_at,
    min(created_at) filter (where event_type = 'roadmap_generated') as first_roadmap_event_at,
    min(created_at) filter (where event_type = 'work_evaluation_completed') as first_work_evaluation_event_at
  from public.usage_events
  group by user_id
)
select
  su.user_id,
  su.user_email,
  su.full_name,
  su.user_created_at,
  coalesce(ir.onboarding_completed_at, er.first_onboarding_event_at) as onboarding_completed_at,
  coalesce(rr.first_recommendations_generated_at, er.first_recommendations_event_at) as first_recommendations_generated_at,
  coalesce(pr.first_project_selected_at, er.first_selection_event_at) as first_project_selected_at,
  coalesce(rm.first_roadmap_generated_at, er.first_roadmap_event_at) as first_roadmap_generated_at,
  mr.first_milestone_completed_at,
  er.first_work_evaluation_event_at,
  sr.first_project_shipped_at,
  coalesce(ir.intake_count, 0) as intake_count,
  coalesce(ir.project_goals_started, '{}'::text[]) as project_goals_started,
  coalesce(rr.recommendation_batch_count, 0) as recommendation_batch_count,
  coalesce(rr.recommendation_count, 0) as recommendation_count,
  coalesce(pr.project_count, 0) as project_count,
  coalesce(pr.active_project_count, 0) as active_project_count,
  coalesce(pr.completed_status_project_count, 0) as completed_status_project_count,
  coalesce(rm.roadmap_count, 0) as roadmap_count,
  coalesce(mr.total_milestone_count, 0) as total_milestone_count,
  coalesce(mr.completed_milestone_count, 0) as completed_milestone_count,
  coalesce(sr.shipped_project_count, 0) as shipped_project_count,
  case
    when sr.first_project_shipped_at is not null then 'shipped'
    when mr.first_milestone_completed_at is not null then 'step_work'
    when rm.first_roadmap_generated_at is not null then 'scoped'
    when pr.first_project_selected_at is not null then 'chosen'
    when rr.first_recommendations_generated_at is not null then 'ideating'
    when ir.onboarding_completed_at is not null then 'onboarded'
    else 'signed_up'
  end as highest_progress_stage,
  round(extract(epoch from (coalesce(pr.first_project_selected_at, er.first_selection_event_at) - coalesce(ir.onboarding_completed_at, er.first_onboarding_event_at))) / 86400.0, 2) as days_onboarding_to_project_selected,
  round(extract(epoch from (coalesce(rm.first_roadmap_generated_at, er.first_roadmap_event_at) - coalesce(pr.first_project_selected_at, er.first_selection_event_at))) / 86400.0, 2) as days_project_selected_to_roadmap,
  round(extract(epoch from (mr.first_milestone_completed_at - coalesce(rm.first_roadmap_generated_at, er.first_roadmap_event_at))) / 86400.0, 2) as days_roadmap_to_first_step_complete,
  round(extract(epoch from (sr.first_project_shipped_at - coalesce(pr.first_project_selected_at, er.first_selection_event_at))) / 86400.0, 2) as days_project_selected_to_shipped
from student_users su
left join intake_rollup ir on ir.user_id = su.user_id
left join recommendation_rollup rr on rr.user_id = su.user_id
left join project_rollup pr on pr.user_id = su.user_id
left join roadmap_rollup rm on rm.user_id = su.user_id
left join milestone_rollup mr on mr.user_id = su.user_id
left join shipped_rollup sr on sr.user_id = su.user_id
left join event_rollup er on er.user_id = su.user_id;

create view private.project_progress_report as
with milestone_rollup as (
  select
    m.project_id,
    count(*)::int as total_milestones,
    count(*) filter (where m.completed)::int as completed_milestones,
    min(m.completed_at) filter (where m.completed_at is not null) as first_milestone_completed_at,
    max(m.completed_at) filter (where m.completed_at is not null) as last_milestone_completed_at
  from public.milestones m
  group by m.project_id
),
guidance_rollup as (
  select
    m.project_id,
    count(g.id)::int as guidance_count,
    min(g.created_at) as first_guidance_generated_at
  from public.milestones m
  join public.milestone_guidance g on g.milestone_id = m.id
  group by m.project_id
),
submission_rollup as (
  select
    m.project_id,
    count(s.id)::int as submission_count,
    min(s.created_at) as first_submission_at,
    max(s.created_at) as latest_submission_at
  from public.milestones m
  join public.milestone_submissions s on s.milestone_id = m.id
  group by m.project_id
),
evaluation_rollup as (
  select
    m.project_id,
    count(e.id) filter (where e.status = 'completed')::int as completed_evaluation_count,
    min(e.updated_at) filter (where e.status = 'completed') as first_completed_evaluation_at,
    max(e.updated_at) filter (where e.status = 'completed') as latest_completed_evaluation_at
  from public.milestones m
  join public.milestone_submissions s on s.milestone_id = m.id
  join public.milestone_submission_evaluations e on e.submission_id = s.id
  group by m.project_id
)
select
  p.user_id,
  u.email as user_email,
  p.id as project_id,
  p.title as project_title,
  p.project_kind_label,
  p.repository_relevance,
  p.status as project_status,
  p.selected_at,
  rec.created_at as recommendation_created_at,
  r.created_at as roadmap_created_at,
  coalesce(mr.total_milestones, 0) as total_milestones,
  coalesce(mr.completed_milestones, 0) as completed_milestones,
  coalesce(gr.guidance_count, 0) as guidance_count,
  coalesce(sr.submission_count, 0) as submission_count,
  coalesce(er.completed_evaluation_count, 0) as completed_evaluation_count,
  mr.first_milestone_completed_at,
  mr.last_milestone_completed_at,
  gr.first_guidance_generated_at,
  sr.first_submission_at,
  sr.latest_submission_at,
  er.first_completed_evaluation_at,
  er.latest_completed_evaluation_at,
  case
    when coalesce(mr.total_milestones, 0) > 0
      and coalesce(mr.completed_milestones, 0) = coalesce(mr.total_milestones, 0)
      then mr.last_milestone_completed_at
    when p.status = 'completed' then p.updated_at
    else null
  end as shipped_at,
  case
    when p.status = 'completed'
      or (
        coalesce(mr.total_milestones, 0) > 0
        and coalesce(mr.completed_milestones, 0) = coalesce(mr.total_milestones, 0)
      ) then 'shipped'
    when coalesce(mr.completed_milestones, 0) > 0 then 'step_work'
    when r.id is not null then 'scoped'
    else 'chosen'
  end as progress_stage,
  case
    when p.status = 'completed'
      or (
        coalesce(mr.total_milestones, 0) > 0
        and coalesce(mr.completed_milestones, 0) = coalesce(mr.total_milestones, 0)
      ) then 100
    when r.id is null then 20
    when coalesce(mr.total_milestones, 0) = 0 then 40
    else round(40 + (coalesce(mr.completed_milestones, 0)::numeric / nullif(mr.total_milestones, 0)) * 50)::int
  end as progress_percent,
  round(extract(epoch from (r.created_at - p.selected_at)) / 86400.0, 2) as days_selected_to_roadmap,
  round(extract(epoch from (mr.first_milestone_completed_at - r.created_at)) / 86400.0, 2) as days_roadmap_to_first_step_complete,
  round(
    extract(epoch from (
      case
        when coalesce(mr.total_milestones, 0) > 0
          and coalesce(mr.completed_milestones, 0) = coalesce(mr.total_milestones, 0)
          then mr.last_milestone_completed_at
        when p.status = 'completed' then p.updated_at
        else null
      end - p.selected_at
    )) / 86400.0,
    2
  ) as days_selected_to_shipped
from public.projects p
join auth.users u on u.id = p.user_id
left join public.project_recommendations rec on rec.id = p.recommendation_id
left join public.project_roadmaps r on r.project_id = p.id
left join milestone_rollup mr on mr.project_id = p.id
left join guidance_rollup gr on gr.project_id = p.id
left join submission_rollup sr on sr.project_id = p.id
left join evaluation_rollup er on er.project_id = p.id;

create view private.weekly_progress_cohorts as
with user_rows as (
  select
    coalesce(
      date_trunc('week', onboarding_completed_at),
      date_trunc('week', user_created_at)
    )::date as cohort_week,
    *
  from private.user_progress_funnel
)
select
  cohort_week,
  count(*)::int as signed_up_users,
  count(*) filter (where onboarding_completed_at is not null)::int as onboarded_users,
  count(*) filter (where first_recommendations_generated_at is not null)::int as ideated_users,
  count(*) filter (where first_project_selected_at is not null)::int as selected_project_users,
  count(*) filter (where first_roadmap_generated_at is not null)::int as scoped_project_users,
  count(*) filter (where first_milestone_completed_at is not null)::int as first_step_completed_users,
  count(*) filter (where first_project_shipped_at is not null)::int as shipped_project_users,
  round(100.0 * count(*) filter (where first_project_selected_at is not null) / nullif(count(*), 0), 1) as signup_to_project_selected_pct,
  round(100.0 * count(*) filter (where first_roadmap_generated_at is not null) / nullif(count(*), 0), 1) as signup_to_scoped_pct,
  round(100.0 * count(*) filter (where first_milestone_completed_at is not null) / nullif(count(*), 0), 1) as signup_to_first_step_complete_pct,
  round(100.0 * count(*) filter (where first_project_shipped_at is not null) / nullif(count(*), 0), 1) as signup_to_shipped_pct
from user_rows
group by cohort_week
order by cohort_week desc;

create view private.impact_summary as
select
  now() as generated_at,
  count(*)::int as signed_up_users,
  count(*) filter (where onboarding_completed_at is not null)::int as onboarded_users,
  count(*) filter (where first_recommendations_generated_at is not null)::int as ideated_users,
  count(*) filter (where first_project_selected_at is not null)::int as selected_project_users,
  count(*) filter (where first_roadmap_generated_at is not null)::int as scoped_project_users,
  count(*) filter (where first_milestone_completed_at is not null)::int as first_step_completed_users,
  count(*) filter (where first_project_shipped_at is not null)::int as shipped_project_users,
  round(100.0 * count(*) filter (where first_project_selected_at is not null) / nullif(count(*), 0), 1) as signup_to_project_selected_pct,
  round(100.0 * count(*) filter (where first_roadmap_generated_at is not null) / nullif(count(*), 0), 1) as signup_to_scoped_pct,
  round(100.0 * count(*) filter (where first_milestone_completed_at is not null) / nullif(count(*), 0), 1) as signup_to_first_step_complete_pct,
  round(100.0 * count(*) filter (where first_project_shipped_at is not null) / nullif(count(*), 0), 1) as signup_to_shipped_pct,
  round(avg(days_onboarding_to_project_selected) filter (where days_onboarding_to_project_selected is not null), 2) as avg_days_onboarding_to_project_selected,
  round(avg(days_project_selected_to_roadmap) filter (where days_project_selected_to_roadmap is not null), 2) as avg_days_project_selected_to_roadmap,
  round(avg(days_roadmap_to_first_step_complete) filter (where days_roadmap_to_first_step_complete is not null), 2) as avg_days_roadmap_to_first_step_complete,
  round(avg(days_project_selected_to_shipped) filter (where days_project_selected_to_shipped is not null), 2) as avg_days_project_selected_to_shipped,
  (select count(*)::int from private.project_progress_report) as total_projects,
  (select count(*)::int from private.project_progress_report where progress_stage = 'shipped') as shipped_projects,
  (select round(avg(progress_percent), 1) from private.project_progress_report) as avg_project_progress_percent
from private.user_progress_funnel;

revoke all on private.user_progress_funnel from public, anon, authenticated;
revoke all on private.project_progress_report from public, anon, authenticated;
revoke all on private.weekly_progress_cohorts from public, anon, authenticated;
revoke all on private.impact_summary from public, anon, authenticated;

grant select on private.user_progress_funnel to service_role;
grant select on private.project_progress_report to service_role;
grant select on private.weekly_progress_cohorts to service_role;
grant select on private.impact_summary to service_role;

-- Private evidence storage. The bucket limit is defense in depth; the API also
-- enforces the five-item, per-file, and aggregate limits before issuing tokens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-evidence',
  'project-evidence',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'application/pdf',
    'text/plain', 'text/markdown', 'text/csv', 'application/json'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.milestone_submission_artifacts (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.milestone_submissions(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  upload_path text,
  external_url text,
  display_name text not null check (char_length(display_name) between 1 and 180),
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 0 and 10485760),
  caption text,
  alt_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestone_submission_artifacts_source_check check (
    (upload_path is not null and external_url is null)
    or (upload_path is null and external_url is not null)
  ),
  constraint milestone_submission_artifacts_https_check check (
    external_url is null or external_url ~ '^https://'
  ),
  constraint milestone_submission_artifacts_caption_check check (
    mime_type like 'text/%' or (caption is not null and char_length(trim(caption)) > 0)
  ),
  unique (upload_path)
);

create trigger trg_milestone_submission_artifacts_updated_at
before update on public.milestone_submission_artifacts
for each row execute function public.set_updated_at();

create index idx_submission_artifacts_submission
  on public.milestone_submission_artifacts(submission_id, created_at);
create index idx_submission_artifacts_owner
  on public.milestone_submission_artifacts(owner_user_id, created_at desc);

alter table public.milestone_submission_artifacts enable row level security;

create policy p_submission_artifacts_select
on public.milestone_submission_artifacts
for select to authenticated
using (
  (select auth.uid()) = owner_user_id
  or exists (
    select 1
    from public.milestone_submissions s
    join public.milestones m on m.id = s.milestone_id
    where s.id = submission_id
      and private.is_active_project_reviewer(m.project_id)
  )
);

create policy p_submission_artifacts_insert
on public.milestone_submission_artifacts
for insert to authenticated
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.milestone_submissions s
    where s.id = submission_id and s.user_id = (select auth.uid())
  )
);

create policy p_submission_artifacts_update
on public.milestone_submission_artifacts
for update to authenticated
using ((select auth.uid()) = owner_user_id)
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1
    from public.milestone_submissions s
    where s.id = submission_id
      and s.user_id = (select auth.uid())
  )
);

create policy p_submission_artifacts_delete
on public.milestone_submission_artifacts
for delete to authenticated
using ((select auth.uid()) = owner_user_id);

grant select, insert, update, delete on public.milestone_submission_artifacts to authenticated;

drop policy if exists p_project_evidence_insert on storage.objects;
create policy p_project_evidence_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'project-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists p_project_evidence_select on storage.objects;
create policy p_project_evidence_select
on storage.objects for select to authenticated
using (
  bucket_id = 'project-evidence'
  and exists (
    select 1
    from public.milestone_submission_artifacts a
    join public.milestone_submissions s on s.id = a.submission_id
    join public.milestones m on m.id = s.milestone_id
    where a.upload_path = name
      and (
        a.owner_user_id = (select auth.uid())
        or private.is_active_project_reviewer(m.project_id)
      )
  )
);

drop policy if exists p_project_evidence_delete on storage.objects;
create policy p_project_evidence_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'project-evidence'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter table public.milestone_submissions
  drop constraint if exists milestone_submissions_submission_kind_check,
  drop constraint if exists milestone_submissions_check;

alter table public.milestone_submissions
  add constraint milestone_submissions_submission_kind_check
  check (submission_kind in ('pasted_text', 'artifact_bundle')),
  add constraint milestone_submissions_content_check
  check (submission_text is not null or submission_kind = 'artifact_bundle');

create table public.portfolio_featured_artifacts (
  portfolio_entry_id uuid not null references public.portfolio_entries(id) on delete cascade,
  artifact_id uuid not null references public.milestone_submission_artifacts(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  display_order integer not null default 0 check (display_order >= 0),
  public_caption text not null check (char_length(trim(public_caption)) > 0),
  public_alt_text text not null check (char_length(trim(public_alt_text)) > 0),
  created_at timestamptz not null default now(),
  primary key (portfolio_entry_id, artifact_id)
);

create index idx_portfolio_featured_artifacts_owner
  on public.portfolio_featured_artifacts(owner_user_id, portfolio_entry_id, display_order);
create index idx_portfolio_featured_artifacts_artifact
  on public.portfolio_featured_artifacts(artifact_id);

alter table public.portfolio_featured_artifacts enable row level security;
create policy p_portfolio_featured_artifacts_owner
on public.portfolio_featured_artifacts
for all to authenticated
using ((select auth.uid()) = owner_user_id)
with check (
  (select auth.uid()) = owner_user_id
  and exists (
    select 1 from public.portfolio_entries pe
    where pe.id = portfolio_entry_id and pe.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.milestone_submission_artifacts a
    where a.id = artifact_id and a.owner_user_id = (select auth.uid())
  )
);

grant select, insert, update, delete on public.portfolio_featured_artifacts to authenticated;

-- Explicit grants keep the new Data API tables available after the 2026
-- automatic-exposure change while RLS remains the authorization boundary.
grant select, insert, update, delete on public.intakes to authenticated;
grant select, insert, update, delete on public.normalized_profiles to authenticated;
grant select, insert, update, delete on public.project_recommendations to authenticated;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.project_roadmaps to authenticated;

-- Atomic bundle writer: the submission, pending evaluation, and artifact rows
-- either all commit or all roll back. Uploaded objects are still temporary
-- until referenced here, and may be cleaned up asynchronously when abandoned.
create or replace function public.create_milestone_artifact_bundle_with_pending_evaluation(
  p_milestone_id uuid,
  p_submission_text text,
  p_artifacts jsonb
)
returns table (
  submission_id uuid,
  evaluation_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_created record;
  v_artifact jsonb;
  v_count integer;
  v_total_bytes bigint;
begin
  if jsonb_typeof(coalesce(p_artifacts, '[]'::jsonb)) <> 'array' then
    raise exception 'Artifacts must be an array';
  end if;

  v_count := jsonb_array_length(coalesce(p_artifacts, '[]'::jsonb));
  if v_count > 5 then raise exception 'A submission can include at most 5 evidence items'; end if;

  select coalesce(sum(coalesce((item->>'size_bytes')::bigint, 0)), 0)
  into v_total_bytes
  from jsonb_array_elements(coalesce(p_artifacts, '[]'::jsonb)) item;
  if v_total_bytes > 26214400 then raise exception 'Evidence bundle exceeds 25 MB'; end if;

  select * into v_created
  from private.create_milestone_submission_with_pending_evaluation(
    p_milestone_id,
    case when v_count > 0 then 'artifact_bundle' else 'pasted_text' end,
    nullif(trim(coalesce(p_submission_text, '')), ''),
    null
  );

  for v_artifact in select value from jsonb_array_elements(coalesce(p_artifacts, '[]'::jsonb))
  loop
    if ((v_artifact ? 'upload_path') = (v_artifact ? 'external_url')) then
      raise exception 'Each evidence item needs exactly one source';
    end if;
    if v_artifact ? 'upload_path' and split_part(v_artifact->>'upload_path', '/', 1) <> auth.uid()::text then
      raise exception 'Upload path is outside the current user folder';
    end if;
    if v_artifact ? 'external_url' and (v_artifact->>'external_url') !~ '^https://' then
      raise exception 'External evidence URLs must use HTTPS';
    end if;
    insert into public.milestone_submission_artifacts (
      submission_id, owner_user_id, upload_path, external_url, display_name,
      mime_type, size_bytes, caption, alt_text
    ) values (
      v_created.submission_id, auth.uid(), v_artifact->>'upload_path', v_artifact->>'external_url',
      left(coalesce(nullif(trim(v_artifact->>'display_name'), ''), 'Evidence item'), 180),
      nullif(v_artifact->>'mime_type', ''), nullif(v_artifact->>'size_bytes', '')::bigint,
      nullif(trim(v_artifact->>'caption'), ''), nullif(trim(v_artifact->>'alt_text'), '')
    );
  end loop;

  return query select v_created.submission_id::uuid, v_created.evaluation_id::uuid;
end;
$$;

revoke all on function public.create_milestone_artifact_bundle_with_pending_evaluation(uuid, text, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.create_milestone_artifact_bundle_with_pending_evaluation(uuid, text, jsonb)
to authenticated;

create or replace function public.set_portfolio_featured_artifacts(p_entry_id uuid, p_artifact_ids uuid[])
returns void language plpgsql security invoker set search_path = '' as $$
declare v_artifact_id uuid; v_order integer := 0;
begin
  if coalesce(cardinality(p_artifact_ids), 0) > 6 then raise exception 'A public gallery can feature at most 6 items'; end if;
  if not exists (select 1 from public.portfolio_entries where id = p_entry_id and user_id = auth.uid()) then raise exception 'Portfolio entry not found'; end if;
  delete from public.portfolio_featured_artifacts where portfolio_entry_id = p_entry_id and owner_user_id = auth.uid();
  foreach v_artifact_id in array coalesce(p_artifact_ids, '{}'::uuid[]) loop
    insert into public.portfolio_featured_artifacts (portfolio_entry_id, artifact_id, owner_user_id, display_order, public_caption, public_alt_text)
    select p_entry_id, a.id, auth.uid(), v_order, trim(a.caption), trim(a.alt_text)
    from public.milestone_submission_artifacts a
    join public.milestone_submissions s on s.id = a.submission_id
    join public.milestones m on m.id = s.milestone_id
    join public.portfolio_entries e on e.id = p_entry_id and e.project_id = m.project_id
    where a.id = v_artifact_id and a.owner_user_id = auth.uid()
      and nullif(trim(a.caption), '') is not null and nullif(trim(a.alt_text), '') is not null;
    if not found then raise exception 'Featured evidence needs a caption and alt text'; end if;
    v_order := v_order + 1;
  end loop;
end; $$;
revoke all on function public.set_portfolio_featured_artifacts(uuid, uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.set_portfolio_featured_artifacts(uuid, uuid[]) to authenticated;
