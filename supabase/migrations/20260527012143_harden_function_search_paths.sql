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

-- Note: is_project_owner and is_active_project_reviewer are moved to the
-- `private` schema in a later migration (20260527030000_move_rls_helpers_to_private_schema.sql)
-- so they are not pinned here.
