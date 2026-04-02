alter table public.milestone_submission_evaluations
  alter column evaluation_json drop not null;

alter table public.milestone_submission_evaluations
  alter column status set default 'pending';

alter table public.milestone_submission_evaluations
  add column if not exists failure_message text,
  add column if not exists updated_at timestamptz not null default now();

update public.milestone_submission_evaluations
set updated_at = created_at
where updated_at is null;

alter table public.milestone_submission_evaluations
  drop constraint if exists milestone_submission_evaluations_status_check;

alter table public.milestone_submission_evaluations
  add constraint milestone_submission_evaluations_status_check
  check (status in ('pending', 'completed', 'failed'));

drop trigger if exists trg_submission_evaluations_updated_at
on public.milestone_submission_evaluations;

create trigger trg_submission_evaluations_updated_at
before update on public.milestone_submission_evaluations
for each row execute function public.set_updated_at();

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
as $$
declare
  v_submission public.milestone_submissions%rowtype;
  v_evaluation public.milestone_submission_evaluations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.milestone_submissions (
    milestone_id,
    user_id,
    submission_kind,
    submission_text,
    submission_filename,
    is_latest
  )
  values (
    p_milestone_id,
    auth.uid(),
    p_submission_kind,
    p_submission_text,
    p_submission_filename,
    true
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
    auth.uid(),
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
