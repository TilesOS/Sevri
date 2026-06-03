-- ------------------------------------------------------------
-- Founder progress reporting.
--
-- These views are intentionally in the private schema so they are not
-- exposed through Supabase Data API/PostgREST. Use them from the SQL
-- editor or a service-role-only report script/admin tool.
-- ------------------------------------------------------------

create schema if not exists private;

create or replace view private.user_progress_funnel as
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
    array_agg(distinct project_track order by project_track) as tracks_started
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
  coalesce(ir.tracks_started, '{}'::text[]) as tracks_started,
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

create or replace view private.project_progress_report as
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
  p.project_track,
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

create or replace view private.weekly_progress_cohorts as
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

create or replace view private.impact_summary as
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
