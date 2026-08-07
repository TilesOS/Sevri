-- Durable lifecycle email state, user preferences, and the project activity
-- clock used by Sevri's activation and coach sequences.

create table public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  lifecycle_enabled boolean not null default false,
  onboarding_default_enabled boolean not null default false,
  enrolled_at timestamptz,
  unsubscribed_at timestamptz,
  delivery_suppressed_at timestamptz,
  delivery_suppression_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lifecycle_enabled = false or enrolled_at is not null)
);

create trigger trg_email_preferences_updated_at
before update on public.email_preferences
for each row execute function public.set_updated_at();

alter table public.email_preferences enable row level security;

revoke all on public.email_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.email_preferences to service_role;

-- Existing accounts are deliberately opted out. New accounts also begin off
-- and explicitly choose during onboarding, where the UI defaults the choice on.
insert into public.email_preferences (user_id, lifecycle_enabled)
select u.id, false
from auth.users u
on conflict (user_id) do nothing;

create schema if not exists private;

create or replace function private.initialize_email_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.email_preferences (user_id, lifecycle_enabled, onboarding_default_enabled)
  values (new.id, false, true)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_users_initialize_email_preferences
after insert on auth.users
for each row execute function private.initialize_email_preferences();

revoke all on function private.initialize_email_preferences()
  from public, anon, authenticated;

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  intake_id uuid references public.intakes(id) on delete cascade,
  message_type text not null check (message_type in (
    'welcome',
    'activation_day_3',
    'activation_day_7',
    'roadmap_ready',
    'coach_inactive_7',
    'coach_inactive_14'
  )),
  dedupe_key text not null unique,
  to_email text not null,
  from_alias text not null check (from_alias in ('hello', 'coach')),
  payload_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'sent', 'delivered', 'failed', 'bounced',
    'complained', 'suppressed', 'canceled'
  )),
  scheduled_for timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  provider_email_id text,
  last_error text,
  last_event_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_email_messages_provider_id
  on public.email_messages(provider_email_id)
  where provider_email_id is not null;
create index idx_email_messages_due
  on public.email_messages(next_attempt_at, scheduled_for)
  where status in ('pending', 'failed', 'processing');
create index idx_email_messages_user_created
  on public.email_messages(user_id, created_at desc);
create index idx_email_messages_project_type
  on public.email_messages(project_id, message_type, created_at desc);

create trigger trg_email_messages_updated_at
before update on public.email_messages
for each row execute function public.set_updated_at();

alter table public.email_messages enable row level security;
revoke all on public.email_messages from public, anon, authenticated;
grant select, insert, update, delete on public.email_messages to service_role;

create table public.email_webhook_events (
  provider_event_id text primary key,
  provider_email_id text,
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now()
);

create index idx_email_webhook_events_provider_email
  on public.email_webhook_events(provider_email_id, occurred_at desc);

alter table public.email_webhook_events enable row level security;
revoke all on public.email_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on public.email_webhook_events to service_role;

-- Claiming is atomic so overlapping cron invocations cannot send the same row.
create or replace function public.claim_email_messages(
  p_limit integer default 25,
  p_now timestamptz default clock_timestamp()
)
returns setof public.email_messages
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select em.id
    from public.email_messages em
    where (
      (em.status in ('pending', 'failed') and em.next_attempt_at <= p_now)
      or (em.status = 'processing' and em.updated_at <= p_now - interval '15 minutes')
    )
      and em.scheduled_for <= p_now
      and em.attempt_count < 3
    order by em.scheduled_for, em.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 25), 100))
  )
  update public.email_messages em
  set status = 'processing',
      attempt_count = em.attempt_count + 1,
      last_error = null,
      updated_at = p_now
  from candidates c
  where em.id = c.id
  returning em.*;
end;
$$;

revoke all on function public.claim_email_messages(integer, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_email_messages(integer, timestamptz)
  to service_role;

alter table public.projects
  add column last_meaningful_activity_at timestamptz;

update public.projects
set last_meaningful_activity_at = coalesce(selected_at, created_at, clock_timestamp())
where last_meaningful_activity_at is null;

alter table public.projects
  alter column last_meaningful_activity_at set default now(),
  alter column last_meaningful_activity_at set not null;

create index idx_projects_lifecycle_activity
  on public.projects(status, archived_at, last_meaningful_activity_at)
  where archived_at is null;

create or replace function private.touch_project_activity(
  p_project_id uuid,
  p_activity_at timestamptz default clock_timestamp()
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.projects
  set last_meaningful_activity_at = greatest(
        last_meaningful_activity_at,
        least(coalesce(p_activity_at, clock_timestamp()), clock_timestamp())
      )
  where id = p_project_id;
$$;

revoke all on function private.touch_project_activity(uuid, timestamptz)
  from public, anon, authenticated;

create or replace function private.track_milestone_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.completed and (not old.completed or new.completed_at is distinct from old.completed_at) then
    perform private.touch_project_activity(new.project_id, coalesce(new.completed_at, clock_timestamp()));
  end if;
  return new;
end;
$$;

create trigger trg_milestones_touch_project_activity
after update of completed, completed_at on public.milestones
for each row execute function private.track_milestone_activity();

create or replace function private.track_roadmap_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.touch_project_activity(new.project_id, clock_timestamp());
  return new;
end;
$$;

create trigger trg_project_roadmaps_touch_project_activity
after insert or update on public.project_roadmaps
for each row execute function private.track_roadmap_activity();

create or replace function private.track_submission_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  select m.project_id into v_project_id
  from public.milestones m
  where m.id = new.milestone_id;
  perform private.touch_project_activity(v_project_id, new.created_at);
  return new;
end;
$$;

create trigger trg_milestone_submissions_touch_project_activity
after insert on public.milestone_submissions
for each row execute function private.track_submission_activity();

create or replace function private.track_checklist_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  if new.checklist_state_json is distinct from old.checklist_state_json then
    select m.project_id into v_project_id
    from public.milestones m
    where m.id = new.milestone_id;
    perform private.touch_project_activity(v_project_id, clock_timestamp());
  end if;
  return new;
end;
$$;

create trigger trg_milestone_guidance_touch_project_activity
after update of checklist_state_json on public.milestone_guidance
for each row execute function private.track_checklist_activity();

create or replace function private.track_work_session_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.completed_at is not null then
    perform private.touch_project_activity(new.project_id, new.completed_at);
  elsif tg_op = 'UPDATE'
     and new.completed_at is not null
     and (old.completed_at is null or new.completed_at is distinct from old.completed_at) then
    perform private.touch_project_activity(new.project_id, new.completed_at);
  end if;
  return new;
end;
$$;

create trigger trg_project_work_sessions_touch_project_activity
after insert or update of completed_at on public.project_work_sessions
for each row execute function private.track_work_session_activity();

create or replace function private.track_focus_block_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  if new.event_type = 'focus_block_completed' then
    begin
      v_project_id := (new.metadata_json ->> 'project_id')::uuid;
    exception when invalid_text_representation then
      return new;
    end;

    if exists (
      select 1 from public.projects p
      where p.id = v_project_id and p.user_id = new.user_id
    ) then
      perform private.touch_project_activity(v_project_id, new.created_at);
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_usage_events_touch_project_activity
after insert on public.usage_events
for each row execute function private.track_focus_block_activity();

create or replace function private.track_github_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_latest_commit_at timestamptz;
begin
  if new.cached_commits is null or jsonb_typeof(new.cached_commits) <> 'array' then
    return new;
  end if;

  begin
    select max((item -> 'author' ->> 'date')::timestamptz)
    into v_latest_commit_at
    from jsonb_array_elements(new.cached_commits) item
    where item -> 'author' ->> 'date' is not null;
  exception when invalid_datetime_format then
    return new;
  end;

  if v_latest_commit_at is not null then
    perform private.touch_project_activity(new.project_id, v_latest_commit_at);
  end if;
  return new;
end;
$$;

create trigger trg_project_github_links_touch_project_activity
after insert or update of cached_commits on public.project_github_links
for each row execute function private.track_github_activity();

revoke all on function private.track_milestone_activity() from public, anon, authenticated;
revoke all on function private.track_roadmap_activity() from public, anon, authenticated;
revoke all on function private.track_submission_activity() from public, anon, authenticated;
revoke all on function private.track_checklist_activity() from public, anon, authenticated;
revoke all on function private.track_work_session_activity() from public, anon, authenticated;
revoke all on function private.track_focus_block_activity() from public, anon, authenticated;
revoke all on function private.track_github_activity() from public, anon, authenticated;

comment on table public.email_preferences is
  'Per-user enrollment and delivery suppression for optional Sevri lifecycle email.';
comment on table public.email_messages is
  'Durable idempotent outbox for transactional and lifecycle email.';
comment on column public.projects.last_meaningful_activity_at is
  'Latest in-app or connected GitHub progress used by coach inactivity sequences.';
