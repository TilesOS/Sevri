-- ------------------------------------------------------------
-- Harden append-only submission/evaluation storage.
-- Public clients can read their own rows, but only trusted RPC
-- paths can write submissions and evaluation lifecycle updates.
-- ------------------------------------------------------------

drop trigger if exists trg_milestone_submission_set_latest
on public.milestone_submissions;

drop function if exists public.set_milestone_submission_latest();

drop index if exists idx_milestone_submissions_latest;

alter table public.milestone_submissions
  drop column if exists is_latest;

create index if not exists idx_milestone_submissions_milestone_created
  on public.milestone_submissions(milestone_id, created_at desc, id desc);

create unique index if not exists idx_submission_evaluations_submission_unique
  on public.milestone_submission_evaluations(submission_id);

drop policy if exists p_milestone_submissions_via_milestone
on public.milestone_submissions;

drop policy if exists p_submission_evaluations_own
on public.milestone_submission_evaluations;

create policy p_milestone_submissions_select_via_milestone
on public.milestone_submissions
for select
using (
  exists (
    select 1
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.id = milestone_id
      and p.user_id = auth.uid()
  )
);

create policy p_submission_evaluations_select_via_submission
on public.milestone_submission_evaluations
for select
using (
  exists (
    select 1
    from public.milestone_submissions s
    join public.milestones m on m.id = s.milestone_id
    join public.projects p on p.id = m.project_id
    where s.id = submission_id
      and p.user_id = auth.uid()
  )
);

create or replace function public.create_milestone_submission_with_pending_evaluation(
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_submission public.milestone_submissions%rowtype;
  v_evaluation public.milestone_submission_evaluations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.id = p_milestone_id
      and p.user_id = v_user_id
  ) then
    raise exception 'Milestone not found or not accessible';
  end if;

  insert into public.milestone_submissions (
    milestone_id,
    user_id,
    submission_kind,
    submission_text,
    submission_filename
  )
  values (
    p_milestone_id,
    v_user_id,
    p_submission_kind,
    p_submission_text,
    p_submission_filename
  )
  returning * into v_submission;

  insert into public.milestone_submission_evaluations (
    submission_id,
    user_id,
    evaluation_json,
    status,
    failure_message
  )
  values (
    v_submission.id,
    v_user_id,
    null,
    'pending',
    null
  )
  returning * into v_evaluation;

  return query
  select
    v_submission.id,
    v_submission.submission_kind,
    v_submission.submission_filename,
    v_submission.created_at,
    v_submission.updated_at,
    v_evaluation.id,
    v_evaluation.status,
    v_evaluation.created_at,
    v_evaluation.updated_at;
end;
$$;

create or replace function public.complete_milestone_submission_evaluation(
  p_evaluation_id uuid,
  p_evaluation_json jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_id uuid;
begin
  if p_evaluation_json is null then
    raise exception 'Evaluation payload is required';
  end if;

  update public.milestone_submission_evaluations
  set
    status = 'completed',
    evaluation_json = p_evaluation_json,
    failure_message = null
  where id = p_evaluation_id
    and status = 'pending'
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'Pending evaluation not found';
  end if;
end;
$$;

create or replace function public.fail_milestone_submission_evaluation(
  p_evaluation_id uuid,
  p_failure_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated_id uuid;
begin
  update public.milestone_submission_evaluations
  set
    status = 'failed',
    evaluation_json = null,
    failure_message = coalesce(nullif(trim(p_failure_message), ''), 'Evaluation failed.')
  where id = p_evaluation_id
    and status = 'pending'
  returning id into v_updated_id;

  if v_updated_id is null then
    raise exception 'Pending evaluation not found';
  end if;
end;
$$;

revoke all on function public.create_milestone_submission_with_pending_evaluation(uuid, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.create_milestone_submission_with_pending_evaluation(uuid, text, text, text)
to authenticated;

revoke all on function public.complete_milestone_submission_evaluation(uuid, jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.complete_milestone_submission_evaluation(uuid, jsonb)
to service_role;

revoke all on function public.fail_milestone_submission_evaluation(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.fail_milestone_submission_evaluation(uuid, text)
to service_role;
