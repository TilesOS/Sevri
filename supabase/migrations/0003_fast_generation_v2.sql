alter table public.milestones
add column if not exists objective text,
add column if not exists deliverable text,
add column if not exists rough_time_estimate text;

update public.milestones
set
  objective = coalesce(objective, description),
  deliverable = coalesce(deliverable, 'Concrete step output'),
  rough_time_estimate = coalesce(rough_time_estimate, 'About 1 week')
where objective is null
   or deliverable is null
   or rough_time_estimate is null;

create table if not exists public.milestone_guidance (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null unique references public.milestones(id) on delete cascade,
  guidance_json jsonb not null,
  email_payload_json jsonb not null default '{}'::jsonb,
  raw_model_output_json jsonb not null default '{}'::jsonb,
  generation_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_milestone_guidance_updated_at
before update on public.milestone_guidance
for each row execute function public.set_updated_at();

create index if not exists idx_milestone_guidance_milestone on public.milestone_guidance(milestone_id);

alter table public.milestone_guidance enable row level security;

create policy p_milestone_guidance_via_milestone on public.milestone_guidance for all
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
