export type Plan = "free" | "pro_monthly";

export type ProjectTrack = "software" | "research";

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

export type TargetOutcome = "college_apps" | "internship" | "portfolio" | "learning";

export type Difficulty = "beginner" | "beginner_intermediate" | "intermediate" | "intermediate_advanced";

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
  project_track: ProjectTrack;
  title: string;
  summary: string;
  rationale: string;
  difficulty: Difficulty;
  estimated_weeks: number;
  weekly_hours: number;
  skills_demonstrated: string[];
  tools_needed: string[];
  impressiveness_score: number;
  finishability_score: number;
  authenticity_note: string;
  track_payload_json?: Record<string, unknown>;
}

export interface Roadmap {
  overview: string;
  mvp_scope: string;
  feature_ladder: {
    must_have: string[];
    should_have: string[];
    could_have: string[];
  };
  milestones: Array<{
    order_index: number;
    title: string;
    description: string;
  }>;
  repo_structure: Array<{
    path: string;
    purpose: string;
  }>;
  readme_draft: string;
  cut_if_behind: string[];
  stretch_goals: string[];
  explanation_guide: {
    elevator_pitch: string;
    resume_bullets: string[];
    interview_talking_points: string[];
  };
}
