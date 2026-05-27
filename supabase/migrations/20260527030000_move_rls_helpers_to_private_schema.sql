-- ------------------------------------------------------------
-- Move RLS helper functions out of the public (PostgREST-exposed)
-- schema so they are not callable as RPCs by signed-in users.
--
-- Supabase Security Advisor (0029) flags every SECURITY DEFINER
-- function in `public` that signed-in users can execute. These two
-- helpers are only referenced from RLS policies, not from the app,
-- so the cleanest fix is to relocate them to a `private` schema
-- that PostgREST does not expose.
-- ------------------------------------------------------------

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.user_id = auth.uid()
  );
$$;

create or replace function private.is_active_project_reviewer(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.project_reviewers pr
    where pr.project_id = p_project_id
      and pr.reviewer_user_id = auth.uid()
      and pr.revoked_at is null
  );
$$;

revoke all on function private.is_project_owner(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.is_project_owner(uuid)
to authenticated, service_role;

revoke all on function private.is_active_project_reviewer(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.is_active_project_reviewer(uuid)
to authenticated, service_role;

-- Drop policies that reference the public helpers, then recreate them
-- against the private helpers. Drops must come before the function drops.

drop policy if exists p_project_reviewers_owner
on public.project_reviewers;

drop policy if exists p_projects_reviewer_select
on public.projects;

drop policy if exists p_project_roadmaps_reviewer_select
on public.project_roadmaps;

drop policy if exists p_milestones_reviewer_select
on public.milestones;

drop policy if exists p_milestone_submissions_reviewer_select
on public.milestone_submissions;

drop policy if exists p_milestone_submission_evaluations_reviewer_select
on public.milestone_submission_evaluations;

drop policy if exists p_milestone_reviews_reviewer_insert
on public.milestone_reviews;

create policy p_project_reviewers_owner on public.project_reviewers for all
  using (private.is_project_owner(project_id))
  with check (private.is_project_owner(project_id));

create policy p_projects_reviewer_select on public.projects
  for select
  using (private.is_active_project_reviewer(id));

create policy p_project_roadmaps_reviewer_select on public.project_roadmaps
  for select
  using (private.is_active_project_reviewer(project_id));

create policy p_milestones_reviewer_select on public.milestones
  for select
  using (private.is_active_project_reviewer(project_id));

create policy p_milestone_submissions_reviewer_select on public.milestone_submissions
  for select
  using (
    exists (
      select 1
      from public.milestones m
      where m.id = milestone_id
        and private.is_active_project_reviewer(m.project_id)
    )
  );

create policy p_milestone_submission_evaluations_reviewer_select on public.milestone_submission_evaluations
  for select
  using (
    exists (
      select 1
      from public.milestone_submissions ms
      join public.milestones m on m.id = ms.milestone_id
      where ms.id = submission_id
        and private.is_active_project_reviewer(m.project_id)
    )
  );

create policy p_milestone_reviews_reviewer_insert on public.milestone_reviews
  for insert
  with check (
    reviewer_user_id = auth.uid()
    and exists (
      select 1
      from public.milestones m
      where m.id = milestone_id
        and private.is_active_project_reviewer(m.project_id)
    )
  );

-- With every policy migrated off the public helpers, drop them.
drop function if exists public.is_project_owner(uuid);
drop function if exists public.is_active_project_reviewer(uuid);
