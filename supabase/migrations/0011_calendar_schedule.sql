alter table public.project_roadmaps
add column if not exists scheduled_start_date date,
add column if not exists scheduled_end_date date,
add column if not exists schedule_timezone text not null default 'UTC',
add column if not exists schedule_generation_source text,
add column if not exists last_schedule_rebalanced_at timestamptz;

alter table public.milestones
add column if not exists due_date date,
add column if not exists schedule_duration_days int,
add column if not exists is_user_scheduled_override boolean not null default false;

update public.milestones
set is_user_scheduled_override = false
where is_user_scheduled_override is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_roadmaps_schedule_generation_source_check') then
    alter table public.project_roadmaps
    add constraint project_roadmaps_schedule_generation_source_check
    check (
      schedule_generation_source is null
      or schedule_generation_source in (
        'roadmap_generation',
        'manual_regenerate',
        'rebalance_downstream',
        'move_only'
      )
    );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'milestones_schedule_duration_days_check') then
    alter table public.milestones
    add constraint milestones_schedule_duration_days_check
    check (schedule_duration_days is null or schedule_duration_days >= 1);
  end if;
end $$;

create index if not exists idx_milestones_project_due_date
  on public.milestones(project_id, due_date);
