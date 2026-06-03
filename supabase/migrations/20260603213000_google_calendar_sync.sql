alter table public.user_integrations
drop constraint if exists user_integrations_provider_check;

alter table public.user_integrations
add constraint user_integrations_provider_check
check (provider in ('github', 'google_calendar'));

create table if not exists public.google_calendar_sync_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  integration_id uuid not null references public.user_integrations(id) on delete cascade,
  calendar_id text,
  calendar_summary text not null default 'Sevri',
  sync_enabled boolean not null default true,
  status text not null default 'active' check (status in ('active', 'invalid', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_google_calendar_sync_settings_updated_at on public.google_calendar_sync_settings;
create trigger trg_google_calendar_sync_settings_updated_at
before update on public.google_calendar_sync_settings
for each row execute function public.set_updated_at();

alter table public.google_calendar_sync_settings enable row level security;

create policy p_google_calendar_sync_settings_own
on public.google_calendar_sync_settings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.google_calendar_sync_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  item_key text not null,
  item_type text not null check (item_type in ('project_start', 'milestone', 'project_end', 'work_session')),
  google_calendar_id text not null,
  google_event_id text not null,
  last_synced_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, project_id, item_key)
);

drop trigger if exists trg_google_calendar_sync_events_updated_at on public.google_calendar_sync_events;
create trigger trg_google_calendar_sync_events_updated_at
before update on public.google_calendar_sync_events
for each row execute function public.set_updated_at();

create index if not exists idx_google_calendar_sync_events_project
  on public.google_calendar_sync_events(user_id, project_id);

alter table public.google_calendar_sync_events enable row level security;

create policy p_google_calendar_sync_events_own
on public.google_calendar_sync_events
for select
using (
  auth.uid() = user_id
  and private.is_project_owner(project_id)
);

grant select, insert, update, delete on public.google_calendar_sync_settings to authenticated;
grant select, insert, update, delete on public.google_calendar_sync_settings to service_role;
grant select on public.google_calendar_sync_events to authenticated;
grant select, insert, update, delete on public.google_calendar_sync_events to service_role;
