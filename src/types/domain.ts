export type Plan = "free" | "pro_monthly";

export type ProjectFormatPreference =
  | "physical"
  | "digital"
  | "investigative"
  | "creative"
  | "community"
  | "venture";

export type ProjectGoal =
  | "learning"
  | "portfolio"
  | "college_applications"
  | "internship_or_job"
  | "class_or_capstone"
  | "competition"
  | "community_impact"
  | "personal"
  | "other";

export type RepositoryRelevance = "recommended" | "optional" | "not_needed";

export type StudentStage =
  | "high_school_freshman"
  | "high_school_sophomore"
  | "high_school_junior"
  | "high_school_senior"
  | "college_freshman"
  | "college_sophomore"
  | "college_junior"
  | "college_senior"
  | "other";

export type TargetOutcome = ProjectGoal;

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type RiskFlag =
  | "too_ambitious"
  | "too_vague"
  | "too_advanced"
  | "too_little_time"
  | "misaligned_goal"
  | "insufficient_guidance"
  | "resource_constraint";

export interface Recommendation {
  id: string;
  normalized_profile_id?: string;
  title: string;
  summary: string;
  why_it_fits: string;
  project_kind_label: string;
  central_challenge: string;
  approach: string;
  primary_artifacts: string[];
  proof_of_success: string[];
  scope_boundary: string;
  resources_needed: string[];
  safety_ethics_notes: string[];
  repository_relevance: RepositoryRelevance;
  difficulty: Difficulty;
  estimated_weeks: number;
  weekly_hours?: number;
  skills_demonstrated?: string[];
  tools_needed?: string[];
  impressiveness_score?: number;
  finishability_score?: number;
  authenticity_note?: string;
  grounding_sources?: Array<{ title: string; url: string }>;
  project_blueprint_json?: Record<string, unknown>;
}

export interface Roadmap {
  project_title: string;
  short_overview: string;
  steps: Array<{
    order_index: number;
    title: string;
    objective: string;
    deliverable: string;
    rough_time_estimate: string;
  }>;
}

export interface StepGuidance {
  what_to_do_now: string;
  checklist: string[];
  pitfalls: string[];
  tools_resources: string[];
  done_when: string[];
  encouragement: string;
  email_version: {
    subject: string;
    preview: string;
    body: string;
  };
}

export interface CriterionVerdict {
  criterion: string;
  verdict: "met" | "pass" | "partial" | "not_yet";
  note: string;
}

export interface WorkEvaluation {
  criterion_verdicts: CriterionVerdict[];
  overall_assessment: string;
  strongest_aspect: string;
  clearest_gap: string;
  next_best_action: string;
  ready_to_mark_complete: boolean;
  confidence?: "high" | "medium" | "low";
  scope_assessment?: {
    drifted: boolean;
    out_of_scope_note: string | null;
  } | null;
  evidence_reviewed: string[];
  evidence_limitations: string[];
}

export type EvaluationLifecycleStatus = "pending" | "completed" | "failed";

export interface StoredMilestoneSubmission {
  id: string;
  evidence_submission_id: string | null;
  submission_kind: "pasted_text" | "artifact_bundle";
  submission_text: string | null;
  submission_filename: string | null;
  created_at: string;
  updated_at: string;
  artifacts?: MilestoneSubmissionArtifact[];
}

export interface MilestoneSubmissionArtifact {
  id: string;
  submission_id: string;
  upload_path: string | null;
  external_url: string | null;
  display_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  alt_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface MilestoneEvaluationState {
  id: string | null;
  status: EvaluationLifecycleStatus;
  evaluation: WorkEvaluation | null;
  failure_message: string | null;
}

export interface LatestCompletedMilestoneEvaluation {
  submission: StoredMilestoneSubmission;
  evaluation: WorkEvaluation;
  evaluation_id: string;
}

export interface MilestoneEvaluationResponse {
  current_submission: StoredMilestoneSubmission | null;
  current_evaluation: MilestoneEvaluationState | null;
  latest_completed_evaluation: LatestCompletedMilestoneEvaluation | null;
}

export type FeedbackStage = "recommendations" | "roadmap" | "step_guidance" | "work_evaluation";
export type FeedbackSignal = "good" | "mixed" | "bad";
