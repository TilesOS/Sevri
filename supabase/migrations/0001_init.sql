create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  student_stage text not null,
  target_outcome text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interests text[] not null default '{}',
  favorite_subjects text[] not null default '{}',
  coding_experience text not null,
  weekly_time_available int not null check (weekly_time_available > 0 and weekly_time_available <= 80),
  preferred_project_style text not null,
  known_tools text[] not null default '{}',
  target_schools_or_companies text[] not null default '{}',
  preferred_difficulty text not null,
  constraints text,
  raw_answers_json jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_intakes_user_created on public.intakes(user_id, created_at desc);

create table public.normalized_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intake_id uuid not null references public.intakes(id) on delete cascade,
  summary text not null,
  interpreted_interests text[] not null default '{}',
  skill_assessment text not null,
  risk_flags text[] not null default '{}',
  raw_model_output_json jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_normalized_profiles_user_intake on public.normalized_profiles(user_id, intake_id);

create table public.project_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intake_id uuid not null references public.intakes(id) on delete cascade,
  normalized_profile_id uuid not null references public.normalized_profiles(id) on delete cascade,
  title text not null,
  summary text not null,
  rationale text not null,
  difficulty text not null,
  estimated_weeks int not null check (estimated_weeks > 0 and estimated_weeks <= 52),
  weekly_hours int not null check (weekly_hours > 0 and weekly_hours <= 80),
  skills_demonstrated text[] not null default '{}',
  tools_needed text[] not null default '{}',
  impressiveness_score int not null check (impressiveness_score between 1 and 10),
  finishability_score int not null check (finishability_score between 1 and 10),
  authenticity_note text not null,
  raw_model_output_json jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_recommendations_user_created on public.project_recommendations(user_id, created_at desc);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recommendation_id uuid not null references public.project_recommendations(id) on delete restrict,
  title text not null,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  selected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create index idx_projects_user_status on public.projects(user_id, status);

create table public.project_roadmaps (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  overview text not null,
  mvp_scope text not null,
  repo_structure jsonb not null,
  readme_draft text not null,
  stretch_goals text[] not null default '{}',
  explanation_guide jsonb not null,
  raw_model_output_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_project_roadmaps_updated_at
before update on public.project_roadmaps
for each row execute function public.set_updated_at();

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  order_index int not null check (order_index >= 0),
  title text not null,
  description text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, order_index)
);

create index idx_milestones_project_order on public.milestones(project_id, order_index);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_checkout_session_id text,
  plan text not null default 'free' check (plan in ('free','pro_monthly')),
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_usage_events_user_type_created on public.usage_events(user_id, event_type, created_at desc);

alter table public.profiles enable row level security;
alter table public.intakes enable row level security;
alter table public.normalized_profiles enable row level security;
alter table public.project_recommendations enable row level security;
alter table public.projects enable row level security;
alter table public.project_roadmaps enable row level security;
alter table public.milestones enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_events enable row level security;

create policy p_profiles_own on public.profiles for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy p_intakes_own on public.intakes for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy p_normalized_profiles_own on public.normalized_profiles for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy p_recommendations_own on public.project_recommendations for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy p_projects_own on public.projects for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy p_roadmaps_via_project on public.project_roadmaps for all
using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy p_milestones_via_project on public.milestones for all
using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()))
with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create policy p_subscriptions_own on public.subscriptions for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy p_usage_events_own on public.usage_events for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);