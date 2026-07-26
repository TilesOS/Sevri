-- Add covering indexes for every foreign key reported by the live
-- Performance Advisor on 2026-07-25.
--
-- PostgreSQL does not create indexes on the referencing side of a foreign
-- key. These columns are used by application filters/joins, RLS ownership
-- checks, or parent-row ON DELETE actions (CASCADE, SET NULL, or RESTRICT).
-- Existing wider indexes whose leftmost column is different do not cover the
-- referential-integrity lookup.

-- Calendar and scheduling query paths.
create index if not exists idx_deadline_extension_events_milestone_id
  on public.deadline_extension_events (milestone_id);

create index if not exists idx_deadline_extension_events_project_id
  on public.deadline_extension_events (project_id);

create index if not exists idx_google_calendar_sync_events_project_id
  on public.google_calendar_sync_events (project_id);

create index if not exists idx_google_calendar_sync_settings_integration_id
  on public.google_calendar_sync_settings (integration_id);

create index if not exists idx_project_work_sessions_milestone_id
  on public.project_work_sessions (milestone_id);

-- Feedback rows are filtered by project/milestone in the application and
-- cascade or null out when their stage-specific source row is removed.
create index if not exists idx_generation_feedback_closest_recommendation_id
  on public.generation_feedback (closest_recommendation_id);

create index if not exists idx_generation_feedback_milestone_guidance_id
  on public.generation_feedback (milestone_guidance_id);

create index if not exists idx_generation_feedback_milestone_id
  on public.generation_feedback (milestone_id);

create index if not exists idx_generation_feedback_normalized_profile_id
  on public.generation_feedback (normalized_profile_id);

create index if not exists idx_generation_feedback_project_id
  on public.generation_feedback (project_id);

create index if not exists idx_generation_feedback_roadmap_id
  on public.generation_feedback (roadmap_id);

create index if not exists idx_generation_feedback_submission_evaluation_id
  on public.generation_feedback (submission_evaluation_id);

-- Reviewer and submission lookup/cascade paths.
create index if not exists idx_milestone_reviews_reviewer_user_id
  on public.milestone_reviews (reviewer_user_id);

create index if not exists idx_milestone_reviews_submission_id
  on public.milestone_reviews (submission_id);

create index if not exists idx_portfolio_entries_featured_submission_id
  on public.portfolio_entries (featured_submission_id);

create index if not exists idx_project_reviewers_invited_by_user_id
  on public.project_reviewers (invited_by_user_id);

-- Recommendation/profile lineage and invitation lifecycle paths.
create index if not exists idx_normalized_profiles_intake_id
  on public.normalized_profiles (intake_id);

create index if not exists idx_project_invitations_accepted_by_user_id
  on public.project_invitations (accepted_by_user_id);

create index if not exists idx_project_recommendations_intake_id
  on public.project_recommendations (intake_id);

create index if not exists idx_project_recommendations_normalized_profile_id
  on public.project_recommendations (normalized_profile_id);

create index if not exists idx_projects_recommendation_id
  on public.projects (recommendation_id);
