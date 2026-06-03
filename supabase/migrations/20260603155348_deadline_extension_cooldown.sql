create table if not exists public.deadline_extension_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete cascade,
  item_type text not null check (item_type in ('milestone', 'project_end')),
  previous_date date not null,
  requested_date date not null,
  move_mode text not null check (move_mode in ('move_only', 'rebalance_downstream')),
  extension_number int not null check (extension_number > 0),
  created_at timestamptz not null default now(),
  check (
    (item_type = 'milestone' and milestone_id is not null)
    or (item_type = 'project_end' and milestone_id is null)
  ),
  check (requested_date > previous_date)
);

create index if not exists idx_deadline_extension_events_item
  on public.deadline_extension_events(user_id, project_id, item_type, milestone_id, created_at desc);

alter table public.deadline_extension_events enable row level security;

create policy p_deadline_extension_events_own
on public.deadline_extension_events
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

create policy p_deadline_extension_events_insert_own
on public.deadline_extension_events
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

grant select, insert on public.deadline_extension_events to authenticated;
grant select, insert, update, delete on public.deadline_extension_events to service_role;
