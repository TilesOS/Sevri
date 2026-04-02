-- ------------------------------------------------------------
-- milestone_submissions
-- Stores each user submission attempt for a milestone step.
-- Multiple rows per milestone are allowed; is_latest = true
-- marks the current submission for UI reads.
-- ------------------------------------------------------------

create table if not exists public.milestone_submissions (
  id                  uuid primary key default gen_random_uuid(),
  milestone_id        uuid not null references public.milestones(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,

  submission_kind     text not null check (submission_kind in ('pasted_text', 'file_upload')),

  submission_text     text,
  submission_filename text,
  storage_path        text,

  is_latest           boolean not null default true,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  check (
    submission_text is not null
    or storage_path is not null
  )
);

create trigger trg_milestone_submissions_updated_at
before update on public.milestone_submissions
for each row execute function public.set_updated_at();

create index if not exists idx_milestone_submissions_latest
  on public.milestone_submissions(milestone_id, is_latest);

create index if not exists idx_milestone_submissions_user_created
  on public.milestone_submissions(user_id, created_at desc);

-- ------------------------------------------------------------
-- Trigger: when a new submission is inserted as is_latest = true,
-- mark all prior submissions for the same milestone as is_latest = false.
-- ------------------------------------------------------------

create or replace function public.set_milestone_submission_latest()
returns trigger
language plpgsql
as $$
begin
  if new.is_latest = true then
    update public.milestone_submissions
    set is_latest = false
    where milestone_id = new.milestone_id
      and id != new.id;
  end if;
  return new;
end;
$$;

create trigger trg_milestone_submission_set_latest
after insert on public.milestone_submissions
for each row execute function public.set_milestone_submission_latest();

-- ------------------------------------------------------------
-- RLS for milestone_submissions
-- Ownership enforced indirectly through milestones -> projects -> user_id,
-- mirroring the milestone_guidance pattern.
-- ------------------------------------------------------------

alter table public.milestone_submissions enable row level security;

create policy p_milestone_submissions_via_milestone on public.milestone_submissions for all
using (
  exists (
    select 1
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.id = milestone_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.milestones m
    join public.projects p on p.id = m.project_id
    where m.id = milestone_id and p.user_id = auth.uid()
  )
);

-- ------------------------------------------------------------
-- milestone_submission_evaluations
-- Stores AI evaluation output for a submission.
-- Append-only; one evaluation per submission.
-- ------------------------------------------------------------

create table if not exists public.milestone_submission_evaluations (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.milestone_submissions(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,

  evaluation_json jsonb not null,
  status          text not null default 'completed',

  created_at      timestamptz not null default now()
);

create index if not exists idx_submission_evaluations_submission_created
  on public.milestone_submission_evaluations(submission_id, created_at desc);

create index if not exists idx_submission_evaluations_user_created
  on public.milestone_submission_evaluations(user_id, created_at desc);

-- ------------------------------------------------------------
-- RLS for milestone_submission_evaluations
-- Direct user_id check — avoids a 3-level join through submissions.
-- ------------------------------------------------------------

alter table public.milestone_submission_evaluations enable row level security;

create policy p_submission_evaluations_own on public.milestone_submission_evaluations for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
