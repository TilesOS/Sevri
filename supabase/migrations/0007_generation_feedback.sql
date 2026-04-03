create table if not exists public.generation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null check (stage in ('recommendations', 'roadmap', 'step_guidance', 'work_evaluation')),
  signal text not null check (signal in ('good', 'mixed', 'bad')),
  notes text,
  normalized_profile_id uuid references public.normalized_profiles(id) on delete cascade,
  closest_recommendation_id uuid references public.project_recommendations(id) on delete set null,
  roadmap_id uuid references public.project_roadmaps(id) on delete cascade,
  milestone_guidance_id uuid references public.milestone_guidance(id) on delete cascade,
  submission_evaluation_id uuid references public.milestone_submission_evaluations(id) on delete cascade,
  project_track text check (project_track in ('software', 'research')),
  project_id uuid references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (case when normalized_profile_id is not null then 1 else 0 end) +
    (case when roadmap_id is not null then 1 else 0 end) +
    (case when milestone_guidance_id is not null then 1 else 0 end) +
    (case when submission_evaluation_id is not null then 1 else 0 end) = 1
  )
);

create trigger trg_generation_feedback_updated_at
before update on public.generation_feedback
for each row execute function public.set_updated_at();

create index if not exists idx_generation_feedback_user_stage_created
  on public.generation_feedback(user_id, stage, created_at desc);

create index if not exists idx_generation_feedback_track_project_created
  on public.generation_feedback(project_track, project_id, created_at desc);

alter table public.generation_feedback enable row level security;

create policy p_generation_feedback_own
on public.generation_feedback for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
