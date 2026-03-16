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
  why_it_fits: string;
  difficulty: Difficulty;
  estimated_weeks: number;
  track_payload_json?: Record<string, unknown>;
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
  deliverables: string[];
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
