create extension if not exists dblink with schema extensions;

delete from auth.users
where id = '11000000-0000-4000-8000-000000000001';

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '11000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'selection-concurrency@example.test',
  '',
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
);

insert into public.intakes (
  id,
  user_id,
  interests,
  favorite_subjects,
  weekly_time_available,
  known_tools,
  target_schools_or_companies,
  constraints,
  raw_answers_json,
  project_track,
  track_payload_json
)
values (
  '21000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  '{}',
  '{}',
  5,
  '{}',
  '{}',
  null,
  '{}'::jsonb,
  'software',
  '{}'::jsonb
);

insert into public.normalized_profiles (
  id,
  user_id,
  intake_id,
  summary,
  interpreted_interests,
  skill_assessment,
  risk_flags,
  raw_model_output_json,
  project_track,
  track_payload_json
)
values (
  '31000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  'Concurrent test profile',
  '{}',
  'Test assessment',
  '{}',
  '{}'::jsonb,
  'software',
  '{}'::jsonb
);

insert into public.project_recommendations (
  id,
  user_id,
  intake_id,
  normalized_profile_id,
  title,
  summary,
  rationale,
  difficulty,
  estimated_weeks,
  weekly_hours,
  skills_demonstrated,
  tools_needed,
  impressiveness_score,
  finishability_score,
  authenticity_note,
  raw_model_output_json,
  project_track,
  track_payload_json
)
values (
  '41000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'Concurrent selection fixture',
  'Test',
  'Test',
  'starter',
  4,
  5,
  '{}',
  '{}',
  5,
  8,
  'Test',
  '{}'::jsonb,
  'software',
  '{}'::jsonb
);

commit;

select plan(3);

select extensions.dblink_connect(
  'selection_c1',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);
select extensions.dblink_connect(
  'selection_c2',
  'host=host.docker.internal port=54322 dbname=postgres user=postgres password=postgres'
);

select extensions.dblink_exec('selection_c1', 'set role authenticated');
select extensions.dblink_exec(
  'selection_c1',
  'set request.jwt.claim.sub = ''11000000-0000-4000-8000-000000000001'''
);
select extensions.dblink_exec('selection_c2', 'set role authenticated');
select extensions.dblink_exec(
  'selection_c2',
  'set request.jwt.claim.sub = ''11000000-0000-4000-8000-000000000001'''
);

select extensions.dblink_exec('selection_c1', 'begin');
select extensions.dblink_send_query(
  'selection_c1',
  $$
    select *
    from public.select_project_from_recommendation(
      '41000000-0000-4000-8000-000000000001',
      '51000000-0000-4000-8000-000000000001',
      false
    )
  $$
);

create temporary table first_selection_result as
select *
from extensions.dblink_get_result('selection_c1') as result(
  project_id uuid,
  project_title text,
  project_track text,
  selection_outcome text
);

-- Consume the protocol's trailing empty result before issuing COMMIT on c1.
select *
from extensions.dblink_get_result('selection_c1') as result(
  project_id uuid,
  project_title text,
  project_track text,
  selection_outcome text
);

select extensions.dblink_send_query(
  'selection_c2',
  $$
    select *
    from public.select_project_from_recommendation(
      '41000000-0000-4000-8000-000000000001',
      '51000000-0000-4000-8000-000000000002',
      false
    )
  $$
);

select is(
  extensions.dblink_is_busy('selection_c2'),
  1,
  'a concurrent default selection waits for the in-flight decision'
);

select extensions.dblink_exec('selection_c1', 'commit');

create temporary table second_selection_result as
select *
from extensions.dblink_get_result('selection_c2') as result(
  project_id uuid,
  project_title text,
  project_track text,
  selection_outcome text
);

select results_eq(
  $$ select selection_outcome from second_selection_result $$,
  $$ values ('duplicate'::text) $$,
  'the waiting default selection returns the first project as a duplicate'
);

select is(
  (
    select count(*)::integer
    from public.projects
    where recommendation_id = '41000000-0000-4000-8000-000000000001'
  ),
  1,
  'two concurrent default operations create exactly one project'
);

select extensions.dblink_disconnect('selection_c1');
select extensions.dblink_disconnect('selection_c2');

delete from auth.users
where id = '11000000-0000-4000-8000-000000000001';

select * from finish();
