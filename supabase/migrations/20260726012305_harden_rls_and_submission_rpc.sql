-- Resolve the Supabase Security/Performance Advisor findings present on
-- 2026-07-25 without changing the application-visible authorization model.
--
-- 1. Scope every user policy to `authenticated` instead of the implicit
--    `PUBLIC` role.
-- 2. Cache auth.uid() once per statement with an initPlan.
-- 3. Merge overlapping permissive SELECT policies while retaining the union
--    of owner and reviewer access.
-- 4. Keep the atomic submission writer, but move its privileged implementation
--    out of the Data API schema and expose only a SECURITY INVOKER wrapper.

-- ---------------------------------------------------------------------------
-- Direct user-owned tables
-- ---------------------------------------------------------------------------

drop policy if exists p_profiles_own on public.profiles;
create policy p_profiles_own
on public.profiles
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists p_intakes_own on public.intakes;
create policy p_intakes_own
on public.intakes
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists p_normalized_profiles_own on public.normalized_profiles;
create policy p_normalized_profiles_own
on public.normalized_profiles
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists p_recommendations_own on public.project_recommendations;
create policy p_recommendations_own
on public.project_recommendations
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists p_subscriptions_own on public.subscriptions;
create policy p_subscriptions_own
on public.subscriptions
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists p_usage_events_own on public.usage_events;
create policy p_usage_events_own
on public.usage_events
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists p_generation_feedback_own on public.generation_feedback;
create policy p_generation_feedback_own
on public.generation_feedback
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists p_google_calendar_sync_settings_own
on public.google_calendar_sync_settings;
create policy p_google_calendar_sync_settings_own
on public.google_calendar_sync_settings
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists p_user_integrations_own on public.user_integrations;
create policy p_user_integrations_own
on public.user_integrations
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists p_project_invitations_owner on public.project_invitations;
create policy p_project_invitations_owner
on public.project_invitations
for all
to authenticated
using (inviter_user_id = (select auth.uid()))
with check (inviter_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Indirect ownership policies without overlapping SELECT paths
-- ---------------------------------------------------------------------------

drop policy if exists p_milestone_guidance_via_milestone
on public.milestone_guidance;
create policy p_milestone_guidance_via_milestone
on public.milestone_guidance
for all
to authenticated
using (
  exists (
    select 1
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.id = milestone_guidance.milestone_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.id = milestone_guidance.milestone_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists p_project_github_links_via_project
on public.project_github_links;
create policy p_project_github_links_via_project
on public.project_github_links
for all
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_github_links.project_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_github_links.project_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists p_portfolio_entries_own on public.portfolio_entries;
create policy p_portfolio_entries_own
on public.portfolio_entries
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.projects p
    where p.id = portfolio_entries.project_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists p_portfolio_exports_own on public.portfolio_exports;
create policy p_portfolio_exports_own
on public.portfolio_exports
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.portfolio_entries pe
    where pe.id = portfolio_exports.portfolio_entry_id
      and pe.user_id = (select auth.uid())
  )
);

drop policy if exists p_portfolio_public_pages_own
on public.portfolio_public_pages;
create policy p_portfolio_public_pages_own
on public.portfolio_public_pages
for all
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.portfolio_entries pe
    where pe.id = portfolio_public_pages.portfolio_entry_id
      and pe.user_id = (select auth.uid())
  )
);

drop policy if exists p_google_calendar_sync_events_own
on public.google_calendar_sync_events;
create policy p_google_calendar_sync_events_own
on public.google_calendar_sync_events
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and private.is_project_owner(project_id)
);

-- Explicit outer-table qualification also fixes the prior
-- `m.project_id = m.project_id` alias-shadowing expression.
drop policy if exists p_deadline_extension_events_own
on public.deadline_extension_events;
create policy p_deadline_extension_events_own
on public.deadline_extension_events
for select
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = deadline_extension_events.milestone_id
        and m.project_id = deadline_extension_events.project_id
    )
  )
);

drop policy if exists p_deadline_extension_events_insert_own
on public.deadline_extension_events;
create policy p_deadline_extension_events_insert_own
on public.deadline_extension_events
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = deadline_extension_events.milestone_id
        and m.project_id = deadline_extension_events.project_id
    )
  )
);

drop policy if exists p_project_work_sessions_own
on public.project_work_sessions;
create policy p_project_work_sessions_own
on public.project_work_sessions
for select
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = project_work_sessions.milestone_id
        and m.project_id = project_work_sessions.project_id
    )
  )
);

drop policy if exists p_project_work_sessions_insert_own
on public.project_work_sessions;
create policy p_project_work_sessions_insert_own
on public.project_work_sessions
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = project_work_sessions.milestone_id
        and m.project_id = project_work_sessions.project_id
    )
  )
);

drop policy if exists p_project_work_sessions_update_own
on public.project_work_sessions;
create policy p_project_work_sessions_update_own
on public.project_work_sessions
for update
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = project_work_sessions.milestone_id
        and m.project_id = project_work_sessions.project_id
    )
  )
)
with check (
  user_id = (select auth.uid())
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = project_work_sessions.milestone_id
        and m.project_id = project_work_sessions.project_id
    )
  )
);

drop policy if exists p_project_work_sessions_delete_own
on public.project_work_sessions;
create policy p_project_work_sessions_delete_own
on public.project_work_sessions
for delete
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_project_owner(project_id)
);

-- ---------------------------------------------------------------------------
-- Consolidate owner/reviewer SELECT policies. The prior ALL policies are split
-- by command so the merged SELECT policy is the only permissive SELECT path.
-- ---------------------------------------------------------------------------

drop policy if exists p_projects_own on public.projects;
drop policy if exists p_projects_reviewer_select on public.projects;

create policy p_projects_select
on public.projects
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_active_project_reviewer(id)
);

create policy p_projects_insert
on public.projects
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy p_projects_update
on public.projects
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy p_projects_delete
on public.projects
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists p_roadmaps_via_project on public.project_roadmaps;
drop policy if exists p_project_roadmaps_reviewer_select
on public.project_roadmaps;

create policy p_project_roadmaps_select
on public.project_roadmaps
for select
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_roadmaps.project_id
      and p.user_id = (select auth.uid())
  )
  or private.is_active_project_reviewer(project_id)
);

create policy p_project_roadmaps_insert
on public.project_roadmaps
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_roadmaps.project_id
      and p.user_id = (select auth.uid())
  )
);

create policy p_project_roadmaps_update
on public.project_roadmaps
for update
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_roadmaps.project_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = project_roadmaps.project_id
      and p.user_id = (select auth.uid())
  )
);

create policy p_project_roadmaps_delete
on public.project_roadmaps
for delete
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_roadmaps.project_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists p_milestones_via_project on public.milestones;
drop policy if exists p_milestones_reviewer_select on public.milestones;

create policy p_milestones_select
on public.milestones
for select
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.user_id = (select auth.uid())
  )
  or private.is_active_project_reviewer(project_id)
);

create policy p_milestones_insert
on public.milestones
for insert
to authenticated
with check (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.user_id = (select auth.uid())
  )
);

create policy p_milestones_update
on public.milestones
for update
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.user_id = (select auth.uid())
  )
);

create policy p_milestones_delete
on public.milestones
for delete
to authenticated
using (
  exists (
    select 1
    from public.projects p
    where p.id = milestones.project_id
      and p.user_id = (select auth.uid())
  )
);

drop policy if exists p_milestone_submissions_select_via_milestone
on public.milestone_submissions;
drop policy if exists p_milestone_submissions_reviewer_select
on public.milestone_submissions;

create policy p_milestone_submissions_select
on public.milestone_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.id = milestone_submissions.milestone_id
      and (
        p.user_id = (select auth.uid())
        or private.is_active_project_reviewer(m.project_id)
      )
  )
);

drop policy if exists p_submission_evaluations_select_via_submission
on public.milestone_submission_evaluations;
drop policy if exists p_milestone_submission_evaluations_reviewer_select
on public.milestone_submission_evaluations;

create policy p_milestone_submission_evaluations_select
on public.milestone_submission_evaluations
for select
to authenticated
using (
  exists (
    select 1
    from public.milestone_submissions ms
    join public.milestones m on m.id = ms.milestone_id
    join public.projects p on p.id = m.project_id
    where ms.id = milestone_submission_evaluations.submission_id
      and (
        p.user_id = (select auth.uid())
        or private.is_active_project_reviewer(m.project_id)
      )
  )
);

drop policy if exists p_milestone_reviews_owner_select
on public.milestone_reviews;
drop policy if exists p_milestone_reviews_reviewer_select
on public.milestone_reviews;
drop policy if exists p_milestone_reviews_reviewer_insert
on public.milestone_reviews;

create policy p_milestone_reviews_select
on public.milestone_reviews
for select
to authenticated
using (
  reviewer_user_id = (select auth.uid())
  or exists (
    select 1
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.id = milestone_reviews.milestone_id
      and p.user_id = (select auth.uid())
  )
);

create policy p_milestone_reviews_reviewer_insert
on public.milestone_reviews
for insert
to authenticated
with check (
  reviewer_user_id = (select auth.uid())
  and exists (
    select 1
    from public.milestones m
    where m.id = milestone_reviews.milestone_id
      and private.is_active_project_reviewer(m.project_id)
  )
);

drop policy if exists p_project_reviewers_owner
on public.project_reviewers;
drop policy if exists p_project_reviewers_self_select
on public.project_reviewers;

create policy p_project_reviewers_select
on public.project_reviewers
for select
to authenticated
using (
  private.is_project_owner(project_id)
  or reviewer_user_id = (select auth.uid())
);

create policy p_project_reviewers_insert
on public.project_reviewers
for insert
to authenticated
with check (private.is_project_owner(project_id));

create policy p_project_reviewers_update
on public.project_reviewers
for update
to authenticated
using (private.is_project_owner(project_id))
with check (private.is_project_owner(project_id));

create policy p_project_reviewers_delete
on public.project_reviewers
for delete
to authenticated
using (private.is_project_owner(project_id));

-- ---------------------------------------------------------------------------
-- Move the privileged atomic writer behind a non-privileged public wrapper.
-- The public signature is unchanged, so the existing supabase-js RPC call and
-- transaction semantics are preserved.
-- ---------------------------------------------------------------------------

alter function public.create_milestone_submission_with_pending_evaluation(
  uuid,
  text,
  text,
  text
)
set schema private;

alter function private.create_milestone_submission_with_pending_evaluation(
  uuid,
  text,
  text,
  text
)
security definer;

alter function private.create_milestone_submission_with_pending_evaluation(
  uuid,
  text,
  text,
  text
)
set search_path = '';

revoke all
on function private.create_milestone_submission_with_pending_evaluation(
  uuid,
  text,
  text,
  text
)
from public, anon, authenticated, service_role;

grant usage on schema private to authenticated;
grant execute
on function private.create_milestone_submission_with_pending_evaluation(
  uuid,
  text,
  text,
  text
)
to authenticated;

create function public.create_milestone_submission_with_pending_evaluation(
  p_milestone_id uuid,
  p_submission_kind text,
  p_submission_text text,
  p_submission_filename text default null
)
returns table (
  submission_id uuid,
  submission_kind text,
  submission_filename text,
  submission_created_at timestamptz,
  submission_updated_at timestamptz,
  evaluation_id uuid,
  evaluation_status text,
  evaluation_created_at timestamptz,
  evaluation_updated_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.create_milestone_submission_with_pending_evaluation(
    p_milestone_id,
    p_submission_kind,
    p_submission_text,
    p_submission_filename
  );
$$;

revoke all
on function public.create_milestone_submission_with_pending_evaluation(
  uuid,
  text,
  text,
  text
)
from public, anon, authenticated, service_role;

grant execute
on function public.create_milestone_submission_with_pending_evaluation(
  uuid,
  text,
  text,
  text
)
to authenticated;

comment on function private.create_milestone_submission_with_pending_evaluation(
  uuid,
  text,
  text,
  text
) is
  'Privileged atomic implementation. Not exposed by the Data API; validates auth.uid() and milestone ownership before writing.';

comment on function public.create_milestone_submission_with_pending_evaluation(
  uuid,
  text,
  text,
  text
) is
  'SECURITY INVOKER Data API wrapper for the private atomic submission writer. Authenticated role only.';
