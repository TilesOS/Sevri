-- Keep webhook retries and lifecycle-recipient scanning durable across function
-- failures and bounded cron invocations.

alter table public.email_webhook_events
  add column processed_at timestamptz;

create index idx_email_webhook_events_unprocessed
  on public.email_webhook_events(received_at)
  where processed_at is null;

create table public.email_planner_state (
  planner_key text primary key,
  cursor_user_id uuid,
  updated_at timestamptz not null default now()
);

insert into public.email_planner_state (planner_key)
values ('lifecycle')
on conflict (planner_key) do nothing;

create trigger trg_email_planner_state_updated_at
before update on public.email_planner_state
for each row execute function public.set_updated_at();

alter table public.email_planner_state enable row level security;
revoke all on public.email_planner_state from public, anon, authenticated;
grant select, insert, update, delete on public.email_planner_state to service_role;

comment on column public.email_webhook_events.processed_at is
  'Set only after the webhook has been applied so provider retries remain actionable.';
comment on table public.email_planner_state is
  'Durable cursors for bounded lifecycle email recipient scans.';
