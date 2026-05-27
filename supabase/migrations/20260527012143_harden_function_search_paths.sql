-- Harden functions flagged by Supabase Security Advisor:
-- Function Search Path Mutable. All referenced app objects in these
-- functions are already schema-qualified, so pinning to an empty path
-- removes caller/session search_path influence.

alter function public.set_updated_at()
  set search_path = '';

alter function public.set_milestone_review_superseded()
  set search_path = '';

alter function public.create_milestone_submission_with_pending_evaluation(uuid, text, text, text)
  set search_path = '';

alter function public.complete_milestone_submission_evaluation(uuid, jsonb)
  set search_path = '';

alter function public.fail_milestone_submission_evaluation(uuid, text)
  set search_path = '';

alter function public.is_project_owner(uuid)
  set search_path = '';

alter function public.is_active_project_reviewer(uuid)
  set search_path = '';

alter function public.rls_auto_enable()
  set search_path = '';

-- rls_auto_enable is invoked by the ensure_rls event trigger; it is not
-- an application RPC and should not be directly executable by API roles.
revoke all on function public.rls_auto_enable()
from public, anon, authenticated, service_role;
