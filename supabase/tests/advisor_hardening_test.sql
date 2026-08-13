begin;

select plan(23);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and roles <> array['authenticated']::name[]
  ),
  0,
  'all application RLS policies explicitly target authenticated'
);

select is(
  (
    with expanded as (
      select
        schemaname,
        tablename,
        role_name,
        action
      from pg_policies
      cross join lateral unnest(roles) role_name
      cross join lateral unnest(
        case cmd
          when 'ALL' then array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
          else array[cmd]
        end
      ) action
      where schemaname = 'public'
        and permissive = 'PERMISSIVE'
    )
    select count(*)::integer
    from (
      select schemaname, tablename, role_name, action
      from expanded
      group by schemaname, tablename, role_name, action
      having count(*) > 1
    ) policy_overlaps
  ),
  0,
  'no table has overlapping permissive policies for one role and action'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and (
        regexp_count(lower(coalesce(qual, '')), 'auth\.uid\(\)')
        + regexp_count(lower(coalesce(with_check, '')), 'auth\.uid\(\)')
      ) <> (
        regexp_count(lower(coalesce(qual, '')), 'select auth\.uid\(\)')
        + regexp_count(lower(coalesce(with_check, '')), 'select auth\.uid\(\)')
      )
  ),
  0,
  'every auth.uid call in an RLS policy is wrapped in a SELECT initPlan'
);

select is(
  (
    select count(*)::integer
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where con.contype = 'f'
      and nsp.nspname = 'public'
      and not exists (
        select 1
        from pg_index idx
        where idx.indrelid = con.conrelid
          and idx.indisvalid
          and (idx.indkey::smallint[])[0:cardinality(con.conkey) - 1] = con.conkey
      )
  ),
  0,
  'all public foreign keys have a covering referencing-side index'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and tablename = 'auth_rate_limits'
  ),
  0,
  'auth_rate_limits intentionally has no user RLS policies'
);

select ok(
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.auth_rate_limits'::regclass
  ),
  'auth_rate_limits keeps RLS enabled as defense in depth'
);

select ok(
  not has_table_privilege(
    'anon',
    'public.auth_rate_limits',
    'select,insert,update,delete'
  ),
  'anon has no auth_rate_limits DML privileges'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.auth_rate_limits',
    'select,insert,update,delete'
  ),
  'authenticated has no auth_rate_limits DML privileges'
);

select ok(
  has_table_privilege(
    'service_role',
    'public.auth_rate_limits',
    'select,insert,update,delete'
  ),
  'service_role retains auth_rate_limits DML privileges'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'private'
      and tablename = 'rate_limit_reservations'
  ),
  0,
  'private rate_limit_reservations also remains service-role-only'
);

select ok(
  not (
    select prosecdef
    from pg_proc
    where oid = (
      'public.create_milestone_submission_with_pending_evaluation'
      '(uuid,text,text,text)'
    )::regprocedure
  ),
  'the public submission RPC is SECURITY INVOKER'
);

select ok(
  (
    select prosecdef
    from pg_proc
    where oid = (
      'private.create_milestone_submission_with_pending_evaluation'
      '(uuid,text,text,text)'
    )::regprocedure
  ),
  'the privileged submission implementation is private and SECURITY DEFINER'
);

select ok(
  (
    select 'search_path=""' = any(coalesce(proconfig, array[]::text[]))
    from pg_proc
    where oid = (
      'public.create_milestone_submission_with_pending_evaluation'
      '(uuid,text,text,text)'
    )::regprocedure
  ),
  'the public submission wrapper has an empty search_path'
);

select ok(
  (
    select 'search_path=""' = any(coalesce(proconfig, array[]::text[]))
    from pg_proc
    where oid = (
      'private.create_milestone_submission_with_pending_evaluation'
      '(uuid,text,text,text)'
    )::regprocedure
  ),
  'the private submission implementation has an empty search_path'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.create_milestone_submission_with_pending_evaluation(uuid,text,text,text)',
    'execute'
  ),
  'authenticated can execute the public submission wrapper'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_milestone_submission_with_pending_evaluation(uuid,text,text,text)',
    'execute'
  ),
  'anon cannot execute the public submission wrapper'
);

select ok(
  not has_function_privilege(
    'service_role',
    'public.create_milestone_submission_with_pending_evaluation(uuid,text,text,text)',
    'execute'
  ),
  'service_role does not gain access to the authenticated submission wrapper'
);

select ok(
  has_function_privilege(
    'authenticated',
    'private.create_milestone_submission_with_pending_evaluation(uuid,text,text,text)',
    'execute'
  ),
  'authenticated can reach the private implementation only through database code'
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
    '12000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'advisor-owner@example.test',
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
    '12000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'advisor-other@example.test',
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
  '22000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001',
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
  '32000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001',
  'Advisor test profile',
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
  '42000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001',
  '22000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  'Advisor hardening fixture',
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

insert into public.projects (
  id,
  user_id,
  recommendation_id,
  selection_operation_id,
  title,
  status,
  project_kind_label
)
values (
  '52000000-0000-4000-8000-000000000001',
  '12000000-0000-4000-8000-000000000001',
  '42000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  'Advisor hardening fixture',
  'active',
  'Web app'
);

insert into public.milestones (
  id,
  project_id,
  order_index,
  title,
  description
)
values (
  '72000000-0000-4000-8000-000000000001',
  '52000000-0000-4000-8000-000000000001',
  0,
  'Test milestone',
  'Test milestone description'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '12000000-0000-4000-8000-000000000001',
  true
);

select results_eq(
  $$
    select evaluation_status
    from public.create_milestone_submission_with_pending_evaluation(
      '72000000-0000-4000-8000-000000000001',
      'pasted_text',
      'Owner submission',
      null
    )
  $$,
  $$ values ('pending'::text) $$,
  'the authenticated owner can use the public wrapper'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.milestone_submissions
    where milestone_id = '72000000-0000-4000-8000-000000000001'
  ),
  1,
  'the wrapper writes one submission'
);

select is(
  (
    select count(*)::integer
    from public.milestone_submission_evaluations mse
    join public.milestone_submissions ms on ms.id = mse.submission_id
    where ms.milestone_id = '72000000-0000-4000-8000-000000000001'
  ),
  1,
  'the wrapper atomically writes one pending evaluation'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '12000000-0000-4000-8000-000000000002',
  true
);

select throws_ok(
  $$
    select *
    from public.create_milestone_submission_with_pending_evaluation(
      '72000000-0000-4000-8000-000000000001',
      'pasted_text',
      'Unauthorized submission',
      null
    )
  $$,
  'P0001',
  'Milestone not found or not accessible',
  'a different authenticated user cannot submit to the owner milestone'
);

reset role;

select is(
  (
    select count(*)::integer
    from public.milestone_submissions
    where milestone_id = '72000000-0000-4000-8000-000000000001'
  ),
  1,
  'the rejected call leaves the atomic row pair unchanged'
);

select * from finish();

rollback;
