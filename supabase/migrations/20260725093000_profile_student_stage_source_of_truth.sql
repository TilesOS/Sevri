-- Student stage belongs to the student, not to a track.
--
-- Each intake stored its own copy in `raw_answers_json`, so a student who ran
-- onboarding twice ended up with two answers ("College freshman" on the software
-- intake, "High school junior" on the research one). Generation reads the intake
-- JSON, so the two tracks then described the same person differently in their
-- pitch and portfolio copy.
--
-- `profiles.student_stage` becomes the single source. This migration only fills
-- profiles that have no stage yet; it never overwrites an answer a student gave
-- in settings, and it leaves every intake row exactly as it was.
--
-- Additive and reversible: no column is added, dropped, or retyped, and no
-- existing non-empty value changes. There is nothing to undo beyond the comment.

comment on column public.profiles.student_stage is
  'Single source of truth for the student''s stage. Intakes may carry a historical copy in raw_answers_json; generation reads this column instead.';

update public.profiles as p
set student_stage = latest.stage
from (
  -- The most recent intake that actually recorded a stage, per user.
  select distinct on (i.user_id)
    i.user_id,
    nullif(btrim(i.raw_answers_json->>'student_stage'), '') as stage
  from public.intakes as i
  where nullif(btrim(i.raw_answers_json->>'student_stage'), '') is not null
  order by i.user_id, i.created_at desc
) as latest
where latest.user_id = p.user_id
  and nullif(btrim(coalesce(p.student_stage, '')), '') is null;
