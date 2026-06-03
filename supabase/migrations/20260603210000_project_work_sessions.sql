create table if not exists public.project_work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  local_date date not null,
  local_time time not null,
  schedule_timezone text not null default 'UTC',
  trigger_context text not null default '',
  work_description text not null,
  location text,
  duration_minutes int not null check (duration_minutes between 5 and 480),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(work_description)) >= 3),
  check (length(trigger_context) <= 160),
  check (location is null or length(location) <= 120)
);

drop trigger if exists trg_project_work_sessions_updated_at on public.project_work_sessions;
create trigger trg_project_work_sessions_updated_at
before update on public.project_work_sessions
for each row execute function public.set_updated_at();

create index if not exists idx_project_work_sessions_project_date
  on public.project_work_sessions(project_id, local_date, local_time);

create index if not exists idx_project_work_sessions_user_date
  on public.project_work_sessions(user_id, local_date, local_time);

alter table public.project_work_sessions enable row level security;

create policy p_project_work_sessions_own
on public.project_work_sessions
for select
using (
  user_id = auth.uid()
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = milestone_id
        and m.project_id = project_id
    )
  )
);

create policy p_project_work_sessions_insert_own
on public.project_work_sessions
for insert
with check (
  user_id = auth.uid()
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = milestone_id
        and m.project_id = project_id
    )
  )
);

create policy p_project_work_sessions_update_own
on public.project_work_sessions
for update
using (
  user_id = auth.uid()
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = milestone_id
        and m.project_id = project_id
    )
  )
)
with check (
  user_id = auth.uid()
  and private.is_project_owner(project_id)
  and (
    milestone_id is null
    or exists (
      select 1
      from public.milestones m
      where m.id = milestone_id
        and m.project_id = project_id
    )
  )
);

create policy p_project_work_sessions_delete_own
on public.project_work_sessions
for delete
using (
  user_id = auth.uid()
  and private.is_project_owner(project_id)
);

grant select, insert, update, delete on public.project_work_sessions to authenticated;
grant select, insert, update, delete on public.project_work_sessions to service_role;
