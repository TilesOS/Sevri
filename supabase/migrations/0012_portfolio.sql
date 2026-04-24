-- ------------------------------------------------------------
-- Portfolio v1.
-- Private portfolio entries are available to all students. Pro-only
-- exports and public pages are persisted here, but quota enforcement
-- stays in usage_events via enforceRateLimit.
-- ------------------------------------------------------------

create table if not exists public.portfolio_entries (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  project_id                 uuid not null references public.projects(id) on delete cascade,
  status_override            text check (
    status_override is null
    or status_override in ('in_progress', 'paused', 'completed', 'abandoned')
  ),
  curated_summary            text check (
    curated_summary is null
    or char_length(curated_summary) <= 1600
  ),
  curation_model             text,
  curation_attempted_at      timestamptz,
  curation_generated_at      timestamptz,
  curation_metadata_json     jsonb not null default '{}'::jsonb,
  student_reflection         text check (
    student_reflection is null
    or char_length(student_reflection) <= 6000
  ),
  featured_submission_id     uuid references public.milestone_submissions(id) on delete set null,
  featured_evidence_note     text check (
    featured_evidence_note is null
    or char_length(featured_evidence_note) <= 1000
  ),
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  unique (project_id)
);

drop trigger if exists trg_portfolio_entries_updated_at on public.portfolio_entries;
create trigger trg_portfolio_entries_updated_at
before update on public.portfolio_entries
for each row execute function public.set_updated_at();

create index if not exists idx_portfolio_entries_user_created
  on public.portfolio_entries(user_id, created_at desc);

create table if not exists public.portfolio_exports (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  portfolio_entry_id     uuid not null references public.portfolio_entries(id) on delete cascade,
  export_format          text not null check (export_format in ('common_app_activity', 'resume_bullets')),
  export_json            jsonb not null,
  export_text            text,
  generation_metadata_json jsonb not null default '{}'::jsonb,
  generated_at           timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  unique (portfolio_entry_id, export_format)
);

create index if not exists idx_portfolio_exports_user_created
  on public.portfolio_exports(user_id, created_at desc);

create table if not exists public.portfolio_public_pages (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references auth.users(id) on delete cascade,
  portfolio_entry_id         uuid not null unique references public.portfolio_entries(id) on delete cascade,
  slug                       text not null unique check (char_length(slug) between 8 and 80),
  display_name_choice        text not null default 'anonymous'
                             check (display_name_choice in ('anonymous', 'real')),
  safety_snapshot_json       jsonb not null default '{}'::jsonb,
  published_at               timestamptz,
  unpublished_at             timestamptz,
  public_acknowledged_at     timestamptz,
  created_at                 timestamptz not null default now()
);

create index if not exists idx_portfolio_public_pages_user_created
  on public.portfolio_public_pages(user_id, created_at desc);

alter table public.portfolio_entries enable row level security;
alter table public.portfolio_exports enable row level security;
alter table public.portfolio_public_pages enable row level security;

create policy p_portfolio_entries_own on public.portfolio_entries for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = auth.uid()
    )
  );

create policy p_portfolio_exports_own on public.portfolio_exports for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolio_entries pe
      where pe.id = portfolio_entry_id
        and pe.user_id = auth.uid()
    )
  );

create policy p_portfolio_public_pages_own on public.portfolio_public_pages for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.portfolio_entries pe
      where pe.id = portfolio_entry_id
        and pe.user_id = auth.uid()
    )
  );
