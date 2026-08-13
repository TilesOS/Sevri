begin;
select plan(36);

select has_column('public', 'intakes', 'project_goal', 'intakes have a universal project goal');
select has_column('public', 'intakes', 'format_preferences', 'intakes support multiple format preferences');
select has_column('public', 'normalized_profiles', 'project_context_json', 'normalized profiles store universal context');
select has_column('public', 'project_recommendations', 'project_blueprint_json', 'recommendations store a universal blueprint');
select has_column('public', 'projects', 'project_kind_label', 'selected projects copy the descriptive kind');
select has_column('public', 'projects', 'repository_relevance', 'selected projects copy repository relevance');
select has_column('public', 'project_roadmaps', 'core_scope', 'roadmaps use core scope');
select has_column('public', 'project_roadmaps', 'artifact_plan', 'roadmaps use artifact plans');
select has_column('public', 'project_roadmaps', 'project_overview_draft', 'roadmaps use a general overview draft');
select has_table('public', 'milestone_submission_artifacts', 'artifact metadata table exists');
select has_table('public', 'portfolio_featured_artifacts', 'portfolio featured-artifact allowlist exists');
select ok((select public = false from storage.buckets where id = 'project-evidence'), 'evidence bucket is private');
select has_function('public', 'create_milestone_artifact_bundle_with_pending_evaluation', array['uuid', 'text', 'jsonb'], 'atomic artifact submission RPC exists');

select hasnt_column('public', 'intakes', 'project_' || 'track', 'legacy intake discriminator is removed');
select hasnt_column('public', 'intakes', 'track_' || 'payload_json', 'legacy intake payload is removed');
select hasnt_column('public', 'projects', 'project_' || 'track', 'legacy project discriminator is removed');
select hasnt_column('public', 'project_recommendations', 'project_' || 'track', 'legacy recommendation discriminator is removed');

select ok(
  has_function_privilege('authenticated', 'public.create_milestone_artifact_bundle_with_pending_evaluation(uuid,text,jsonb)', 'execute'),
  'authenticated students can execute the atomic evidence RPC'
);
select ok(
  not has_function_privilege('anon', 'public.create_milestone_artifact_bundle_with_pending_evaluation(uuid,text,jsonb)', 'execute'),
  'anonymous callers cannot execute the atomic evidence RPC'
);
select ok(
  not (select prosecdef from pg_proc where oid = 'public.create_milestone_artifact_bundle_with_pending_evaluation(uuid,text,jsonb)'::regprocedure),
  'the atomic evidence RPC is security invoker'
);
select ok(
  position('private.create_milestone_submission_with_pending_evaluation' in pg_get_functiondef('public.create_milestone_artifact_bundle_with_pending_evaluation(uuid,text,jsonb)'::regprocedure)) > 0,
  'the evidence RPC delegates submission and pending-evaluation creation to the hardened writer'
);
select ok(
  position('insert into public.milestone_submission_artifacts' in lower(pg_get_functiondef('public.create_milestone_artifact_bundle_with_pending_evaluation(uuid,text,jsonb)'::regprocedure))) > 0,
  'artifact rows are written inside the same RPC transaction'
);

select ok((select relrowsecurity from pg_class where oid = 'public.milestone_submission_artifacts'::regclass), 'artifact metadata has RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.portfolio_featured_artifacts'::regclass), 'public-feature allowlist has RLS enabled');
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'milestone_submission_artifacts'),
  4,
  'artifact metadata has one policy for each operation without overlapping permissive policies'
);
select ok(
  position('is_active_project_reviewer' in coalesce((select qual from pg_policies where schemaname = 'public' and tablename = 'milestone_submission_artifacts' and cmd = 'SELECT'), '')) > 0,
  'artifact SELECT policy grants authorized reviewer access'
);
select is((select file_size_limit from storage.buckets where id = 'project-evidence'), 10485760::bigint, 'evidence bucket enforces the 10 MB per-file limit');
select ok(has_table_privilege('authenticated', 'public.milestone_submission_artifacts', 'select,insert,update,delete'), 'authenticated role has artifact DML grants behind RLS');
select ok(has_table_privilege('authenticated', 'public.portfolio_featured_artifacts', 'select,insert,update,delete'), 'authenticated role has featured-artifact DML grants behind RLS');
select ok(
  exists (select 1 from pg_index where indrelid = 'public.milestone_submission_artifacts'::regclass and indkey::text like '2%'),
  'artifact submission foreign key has a referencing-side index'
);
select ok(
  exists (select 1 from pg_index where indrelid = 'public.portfolio_featured_artifacts'::regclass and indkey::text like '2%'),
  'featured artifact foreign key has a referencing-side index'
);

select has_function('public', 'set_portfolio_featured_artifacts', array['uuid', 'uuid[]'], 'explicit public-feature allowlist RPC exists');
select ok(has_function_privilege('authenticated', 'public.set_portfolio_featured_artifacts(uuid,uuid[])', 'execute'), 'authenticated owners can set featured evidence');
select ok(not has_function_privilege('anon', 'public.set_portfolio_featured_artifacts(uuid,uuid[])', 'execute'), 'anonymous callers cannot set featured evidence');
select ok(
  position('e.project_id = m.project_id' in pg_get_functiondef('public.set_portfolio_featured_artifacts(uuid,uuid[])'::regprocedure)) > 0,
  'featured evidence must belong to the same portfolio project'
);
select ok(
  exists (select 1 from pg_constraint where conrelid = 'public.milestone_submission_artifacts'::regclass and conname = 'milestone_submission_artifacts_https_check'),
  'external evidence is constrained to HTTPS'
);

select * from finish();
rollback;
