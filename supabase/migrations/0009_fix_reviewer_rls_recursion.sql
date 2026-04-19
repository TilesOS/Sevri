-- ------------------------------------------------------------
-- Fix reviewer RLS recursion and ambiguous column bindings.
-- 0008 introduced policies where projects read project_reviewers
-- and project_reviewers read projects, which can recurse under RLS.
-- These SECURITY DEFINER helpers break the cycle and make the
-- project_id checks explicit across reviewer-facing tables.
-- ------------------------------------------------------------

create or replace function public.is_project_owner(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.user_id = auth.uid()
  );
$$;

create or replace function public.is_active_project_reviewer(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
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

revoke all on function public.is_project_owner(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.is_project_owner(uuid)
to authenticated, service_role;

revoke all on function public.is_active_project_reviewer(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.is_active_project_reviewer(uuid)
to authenticated, service_role;

drop policy if exists p_project_reviewers_owner
on public.project_reviewers;

create policy p_project_reviewers_owner on public.project_reviewers for all
  using (public.is_project_owner(project_id))
  with check (public.is_project_owner(project_id));

drop policy if exists p_projects_reviewer_select
on public.projects;

create policy p_projects_reviewer_select on public.projects
  for select
  using (public.is_active_project_reviewer(id));

drop policy if exists p_project_roadmaps_reviewer_select
on public.project_roadmaps;

create policy p_project_roadmaps_reviewer_select on public.project_roadmaps
  for select
  using (public.is_active_project_reviewer(project_id));

drop policy if exists p_milestones_reviewer_select
on public.milestones;

create policy p_milestones_reviewer_select on public.milestones
  for select
  using (public.is_active_project_reviewer(project_id));

drop policy if exists p_milestone_submissions_reviewer_select
on public.milestone_submissions;

create policy p_milestone_submissions_reviewer_select on public.milestone_submissions
  for select
  using (
    exists (
      select 1
      from public.milestones m
      where m.id = milestone_id
        and public.is_active_project_reviewer(m.project_id)
    )
  );

drop policy if exists p_milestone_submission_evaluations_reviewer_select
on public.milestone_submission_evaluations;

create policy p_milestone_submission_evaluations_reviewer_select on public.milestone_submission_evaluations
  for select
  using (
    exists (
      select 1
      from public.milestone_submissions ms
      join public.milestones m on m.id = ms.milestone_id
      where ms.id = submission_id
        and public.is_active_project_reviewer(m.project_id)
    )
  );

drop policy if exists p_milestone_reviews_reviewer_insert
on public.milestone_reviews;

create policy p_milestone_reviews_reviewer_insert on public.milestone_reviews
  for insert
  with check (
    reviewer_user_id = auth.uid()
    and exists (
      select 1
      from public.milestones m
      where m.id = milestone_id
        and public.is_active_project_reviewer(m.project_id)
    )
  );
