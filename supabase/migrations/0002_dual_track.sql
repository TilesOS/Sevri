alter table public.profiles
add column if not exists project_track text not null default 'software';

alter table public.intakes
add column if not exists project_track text not null default 'software',
add column if not exists track_payload_json jsonb not null default '{}'::jsonb;

alter table public.normalized_profiles
add column if not exists project_track text not null default 'software',
add column if not exists track_payload_json jsonb not null default '{}'::jsonb;

alter table public.project_recommendations
add column if not exists project_track text not null default 'software',
add column if not exists track_payload_json jsonb not null default '{}'::jsonb;

alter table public.projects
add column if not exists project_track text not null default 'software';

alter table public.project_roadmaps
add column if not exists project_track text not null default 'software',
add column if not exists track_payload_json jsonb not null default '{}'::jsonb;

alter table public.intakes
alter column coding_experience drop not null,
alter column preferred_project_style drop not null,
alter column preferred_difficulty drop not null;

update public.profiles set project_track = 'software' where project_track is null;
update public.intakes set project_track = 'software' where project_track is null;
update public.normalized_profiles set project_track = 'software' where project_track is null;
update public.project_recommendations set project_track = 'software' where project_track is null;
update public.projects set project_track = 'software' where project_track is null;
update public.project_roadmaps set project_track = 'software' where project_track is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_project_track_check') then
    alter table public.profiles
    add constraint profiles_project_track_check
    check (project_track in ('software', 'research'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'intakes_project_track_check') then
    alter table public.intakes
    add constraint intakes_project_track_check
    check (project_track in ('software', 'research'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'normalized_profiles_project_track_check') then
    alter table public.normalized_profiles
    add constraint normalized_profiles_project_track_check
    check (project_track in ('software', 'research'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'project_recommendations_project_track_check') then
    alter table public.project_recommendations
    add constraint project_recommendations_project_track_check
    check (project_track in ('software', 'research'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'projects_project_track_check') then
    alter table public.projects
    add constraint projects_project_track_check
    check (project_track in ('software', 'research'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'project_roadmaps_project_track_check') then
    alter table public.project_roadmaps
    add constraint project_roadmaps_project_track_check
    check (project_track in ('software', 'research'));
  end if;
end $$;
