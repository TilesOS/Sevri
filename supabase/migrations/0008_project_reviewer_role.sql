-- ------------------------------------------------------------
-- Project Reviewer role.
-- Pro students can invite up to 2 outside reviewers per project.
-- Reviewers get read-only access to the project mirror and
-- append-only structured reviews on each milestone.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- profiles: user_role + display_name
-- ------------------------------------------------------------

alter table public.profiles
  add column if not exists user_role text not null default 'student',
  add column if not exists display_name text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_user_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_user_role_check
      check (user_role in ('student', 'reviewer'));
  end if;
end $$;

-- Reviewer profile rows skip onboarding, so student-only columns become nullable.
alter table public.profiles
  alter column full_name drop not null,
  alter column student_stage drop not null,
  alter column target_outcome drop not null;

-- ------------------------------------------------------------
-- project_invitations
-- Pending invitation state. Tokens are plain, single-use,
-- never logged, never echoed after creation. Only reachable
-- via the service-role client.
-- ------------------------------------------------------------

create table if not exists public.project_invitations (
  id                   uuid primary key default gen_random_uuid(),
  project_id           uuid not null references public.projects(id) on delete cascade,
  inviter_user_id      uuid not null references auth.users(id) on delete cascade,
  reviewer_email       text not null,
  reviewer_email_lower text not null,
  token                text not null unique,
  personal_note        text,
  status               text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at           timestamptz not null default now(),
  expires_at           timestamptz not null default (now() + interval '14 days'),
  accepted_at          timestamptz,
  accepted_by_user_id  uuid references auth.users(id) on delete set null
);

create index if not exists idx_project_invitations_project_status
  on public.project_invitations(project_id, status);

create index if not exists idx_project_invitations_inviter_created
  on public.project_invitations(inviter_user_id, created_at desc);

create unique index if not exists idx_project_invitations_project_email_pending
  on public.project_invitations(project_id, reviewer_email_lower)
  where status = 'pending';

alter table public.project_invitations enable row level security;

create policy p_project_invitations_owner on public.project_invitations for all
  using (inviter_user_id = auth.uid())
  with check (inviter_user_id = auth.uid());

-- ------------------------------------------------------------
-- project_reviewers
-- Confirmed reviewer membership. revoked_at is null = active.
-- ------------------------------------------------------------

create table if not exists public.project_reviewers (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  reviewer_user_id   uuid not null references auth.users(id) on delete cascade,
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  joined_at          timestamptz not null default now(),
  revoked_at         timestamptz,
  unique (project_id, reviewer_user_id)
);

create index if not exists idx_project_reviewers_project_active
  on public.project_reviewers(project_id) where revoked_at is null;

create index if not exists idx_project_reviewers_reviewer_active
  on public.project_reviewers(reviewer_user_id) where revoked_at is null;

alter table public.project_reviewers enable row level security;

create policy p_project_reviewers_owner on public.project_reviewers for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );

create policy p_project_reviewers_self_select on public.project_reviewers
  for select
  using (reviewer_user_id = auth.uid());

-- ------------------------------------------------------------
-- milestone_reviews
-- Append-only structured reviews. Trigger supersedes prior
-- rows per (milestone_id, reviewer_user_id) on insert.
-- ------------------------------------------------------------

create table if not exists public.milestone_reviews (
  id                     uuid primary key default gen_random_uuid(),
  milestone_id           uuid not null references public.milestones(id) on delete cascade,
  reviewer_user_id       uuid not null references auth.users(id) on delete cascade,
  submission_id          uuid references public.milestone_submissions(id) on delete set null,
  strength               text not null check (char_length(strength) between 10 and 500),
  tighten                text not null check (char_length(tighten) between 10 and 500),
  next_action            text not null check (char_length(next_action) between 10 and 500),
  ready_to_mark_complete boolean not null,
  created_at             timestamptz not null default now(),
  superseded_at          timestamptz
);

create index if not exists idx_milestone_reviews_milestone_latest
  on public.milestone_reviews(milestone_id, reviewer_user_id)
  where superseded_at is null;

create index if not exists idx_milestone_reviews_milestone_created
  on public.milestone_reviews(milestone_id, created_at desc);

create or replace function public.set_milestone_review_superseded()
returns trigger
language plpgsql
as $$
begin
  update public.milestone_reviews
  set superseded_at = now()
  where milestone_id = new.milestone_id
    and reviewer_user_id = new.reviewer_user_id
    and id != new.id
    and superseded_at is null;
  return new;
end;
$$;

drop trigger if exists trg_milestone_reviews_superseded on public.milestone_reviews;

create trigger trg_milestone_reviews_superseded
after insert on public.milestone_reviews
for each row execute function public.set_milestone_review_superseded();

alter table public.milestone_reviews enable row level security;

create policy p_milestone_reviews_reviewer_insert on public.milestone_reviews
  for insert
  with check (
    reviewer_user_id = auth.uid()
    and exists (
      select 1
      from public.milestones m
      join public.project_reviewers pr on pr.project_id = m.project_id
      where m.id = milestone_id
        and pr.reviewer_user_id = auth.uid()
        and pr.revoked_at is null
    )
  );

create policy p_milestone_reviews_owner_select on public.milestone_reviews
  for select
  using (
    exists (
      select 1
      from public.milestones m
      join public.projects p on p.id = m.project_id
      where m.id = milestone_id and p.user_id = auth.uid()
    )
  );

create policy p_milestone_reviews_reviewer_select on public.milestone_reviews
  for select
  using (reviewer_user_id = auth.uid());

-- ------------------------------------------------------------
-- Reviewer SELECT policies on existing tables.
-- Split-policy precedent from migration 0006 - new policies
-- are added alongside existing owner policies, not ORed into
-- them. Reviewers get SELECT only; no INSERT / UPDATE / DELETE.
-- ------------------------------------------------------------

create policy p_projects_reviewer_select on public.projects
  for select
  using (
    exists (
      select 1 from public.project_reviewers pr
      where pr.project_id = id
        and pr.reviewer_user_id = auth.uid()
        and pr.revoked_at is null
    )
  );

create policy p_project_roadmaps_reviewer_select on public.project_roadmaps
  for select
  using (
    exists (
      select 1 from public.project_reviewers pr
      where pr.project_id = project_id
        and pr.reviewer_user_id = auth.uid()
        and pr.revoked_at is null
    )
  );

create policy p_milestones_reviewer_select on public.milestones
  for select
  using (
    exists (
      select 1 from public.project_reviewers pr
      where pr.project_id = project_id
        and pr.reviewer_user_id = auth.uid()
        and pr.revoked_at is null
    )
  );

create policy p_milestone_submissions_reviewer_select on public.milestone_submissions
  for select
  using (
    exists (
      select 1
      from public.milestones m
      join public.project_reviewers pr on pr.project_id = m.project_id
      where m.id = milestone_id
        and pr.reviewer_user_id = auth.uid()
        and pr.revoked_at is null
    )
  );

create policy p_milestone_submission_evaluations_reviewer_select on public.milestone_submission_evaluations
  for select
  using (
    exists (
      select 1
      from public.milestone_submissions ms
      join public.milestones m on m.id = ms.milestone_id
      join public.project_reviewers pr on pr.project_id = m.project_id
      where ms.id = submission_id
        and pr.reviewer_user_id = auth.uid()
        and pr.revoked_at is null
    )
  );
