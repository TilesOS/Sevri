begin;

select plan(19);

select has_column(
  'public',
  'projects',
  'archived_at',
  'projects store archive visibility separately'
);

select has_column(
  'public',
  'projects',
  'selection_operation_id',
  'projects persist the client selection operation'
);

select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.projects'::regclass
      and conname = 'projects_user_selection_operation_key'
      and contype = 'u'
  ),
  'selection operations are unique per user'
);

select has_function(
  'public',
  'select_project_from_recommendation',
  array['uuid', 'uuid', 'boolean'],
  'the atomic recommendation selection RPC exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.select_project_from_recommendation(uuid,uuid,boolean)',
    'execute'
  ),
  'anonymous callers cannot select projects'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.select_project_from_recommendation(uuid,uuid,boolean)',
    'execute'
  ),
  'authenticated callers can select their own recommendations'
);

select ok(
  position(
    'pg_advisory_xact_lock'
    in pg_get_functiondef(
      'public.select_project_from_recommendation(uuid,uuid,boolean)'::regprocedure
    )
  ) > 0,
  'default selections serialize the duplicate decision under a transaction lock'
);

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
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'selection-owner@example.test',
    '',
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'selection-other@example.test',
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
  raw_answers_json,
  project_goal,
  success_definition,
  experience_level
)
values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '{}',
  '{}',
  5,
  '{}'::jsonb,
  'learning',
  'A finished project the student can explain.',
  'beginner'
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
  project_context_json
)
values (
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Test profile',
  '{}',
  'Test assessment',
  '{}',
  '{}'::jsonb,
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
  project_kind_label,
  project_blueprint_json
)
values (
  '40000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'Atomic selection fixture',
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
  'Web app',
  '{}'::jsonb
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

select results_eq(
  $$
    select selection_outcome
    from public.select_project_from_recommendation(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      false
    )
  $$,
  $$ values ('created'::text) $$,
  'the first default selection creates a project'
);

select results_eq(
  $$
    select project_id
    from public.select_project_from_recommendation(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      false
    )
  $$,
  $$
    select id
    from public.projects
    where selection_operation_id = '50000000-0000-4000-8000-000000000001'
  $$,
  'an idempotent retry returns the originally created project'
);

select results_eq(
  $$
    select selection_outcome
    from public.select_project_from_recommendation(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000002',
      false
    )
  $$,
  $$ values ('duplicate'::text) $$,
  'a second unconfirmed operation observes the serialized default selection'
);

select is(
  (
    select count(*)::integer
    from public.projects
    where recommendation_id = '40000000-0000-4000-8000-000000000001'
  ),
  1,
  'concurrent-default semantics leave only one project'
);

select results_eq(
  $$
    select selection_outcome
    from public.select_project_from_recommendation(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000003',
      true
    )
  $$,
  $$ values ('created'::text) $$,
  'a new explicitly confirmed operation creates a duplicate'
);

select is(
  (
    select count(*)::integer
    from public.projects
    where recommendation_id = '40000000-0000-4000-8000-000000000001'
  ),
  2,
  'the explicitly allowed duplicate is retained'
);

select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$
    select *
    from public.select_project_from_recommendation(
      '40000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000004',
      false
    )
  $$,
  'P0002',
  'recommendation not found',
  'recommendation ownership is enforced inside the RPC'
);

reset role;

insert into public.projects (
  id,
  user_id,
  recommendation_id,
  selection_operation_id,
  title,
  status,
  project_kind_label
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'Active lifecycle fixture',
    'active',
    'Web app'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000002',
    'Paused lifecycle fixture',
    'paused',
    'Web app'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000003',
    'Completed lifecycle fixture',
    'completed',
    'Web app'
  );

update public.projects
set archived_at = now()
where id::text like '60000000-0000-4000-8000-00000000000%';

select results_eq(
  $$
    select status
    from public.projects
    where id::text like '60000000-0000-4000-8000-00000000000%'
    order by id
  $$,
  $$ values ('active'::text), ('paused'::text), ('completed'::text) $$,
  'archiving preserves active, paused, and completed lifecycle status'
);

update public.projects
set archived_at = null
where id::text like '60000000-0000-4000-8000-00000000000%';

select results_eq(
  $$
    select status
    from public.projects
    where id::text like '60000000-0000-4000-8000-00000000000%'
    order by id
  $$,
  $$ values ('active'::text), ('paused'::text), ('completed'::text) $$,
  'restoring preserves each pre-archive lifecycle status'
);

update public.projects
set archived_at = now()
where id = '60000000-0000-4000-8000-000000000001';

select is(
  (
    select count(*)::integer
    from public.projects
    where id::text like '60000000-0000-4000-8000-00000000000%'
      and status in ('active', 'paused', 'completed')
      and archived_at is null
  ),
  2,
  'dashboard visibility excludes archived projects'
);

select is(
  (
    select count(*)::integer
    from public.projects
    where id::text like '60000000-0000-4000-8000-00000000000%'
      and status in ('active', 'paused', 'completed')
      and archived_at is null
  ),
  2,
  'calendar visibility excludes archived projects'
);

select is(
  (
    select count(*)::integer
    from public.projects
    where id::text like '60000000-0000-4000-8000-00000000000%'
  ),
  3,
  'Portfolio visibility retains archived projects'
);

select * from finish();
rollback;
