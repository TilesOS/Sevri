-- ------------------------------------------------------------
-- GitHub integration (v1).
-- Pro students can link one public repo per software-track project.
-- OAuth tokens are encrypted at rest by the application layer
-- (AES-256-GCM, see src/lib/integrations/github/encryption.ts).
-- A 5-minute server-side cache lives on the link row itself.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- user_integrations
-- One row per (user_id, provider). Forward-compatible with
-- additional providers via the provider check constraint.
-- ------------------------------------------------------------

create table if not exists public.user_integrations (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  provider                text not null check (provider in ('github')),
  access_token_encrypted  bytea not null,
  refresh_token_encrypted bytea,
  token_expires_at        timestamptz,
  scopes                  text[] not null default '{}',
  provider_user_id        text not null,
  provider_username       text not null,
  status                  text not null default 'active'
                          check (status in ('active','revoked','invalid')),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, provider)
);

drop trigger if exists trg_user_integrations_updated_at on public.user_integrations;
create trigger trg_user_integrations_updated_at
before update on public.user_integrations
for each row execute function public.set_updated_at();

alter table public.user_integrations enable row level security;

drop policy if exists p_user_integrations_own on public.user_integrations;
create policy p_user_integrations_own on public.user_integrations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- project_github_links
-- One row per project. Holds the linked repo identity, the
-- 5-minute cache payload, and the repo health status.
-- ------------------------------------------------------------

create table if not exists public.project_github_links (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null unique references public.projects(id) on delete cascade,
  repo_full_name text not null,
  default_branch text not null,
  readme_sha     text,
  cached_commits jsonb,
  cached_readme  text,
  last_synced_at timestamptz,
  status         text not null default 'active'
                 check (status in ('active','broken')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_project_github_links_updated_at on public.project_github_links;
create trigger trg_project_github_links_updated_at
before update on public.project_github_links
for each row execute function public.set_updated_at();

alter table public.project_github_links enable row level security;

drop policy if exists p_project_github_links_via_project on public.project_github_links;
create policy p_project_github_links_via_project on public.project_github_links for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = auth.uid()
    )
  );
