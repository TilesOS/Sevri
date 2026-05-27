-- Persist per-checklist-item completion state alongside generated guidance.
-- Stored as a jsonb object keyed by string index ("0", "1", ...) → boolean.
-- The state is reset whenever the underlying checklist regenerates (handled in app code).

alter table public.milestone_guidance
add column if not exists checklist_state_json jsonb not null default '{}'::jsonb;
