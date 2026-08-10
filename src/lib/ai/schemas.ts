import { z } from "zod";

export const RiskFlagSchema = z.enum([
  "too_ambitious",
  "too_vague",
  "too_advanced",
  "too_little_time",
  "misaligned_goal",
  "insufficient_guidance",
  "resource_constraint",
]);

export const SkillAssessmentSchema = z.enum(["beginner", "intermediate", "advanced"]);

export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const ProjectContextPayloadSchema = z.object({
  domain_brief: z.string().min(30),
  anchor_interests: z.array(z.string().min(2)).min(1).max(8),
  goal_signal: z.string().min(12),
  success_definition: z.string().min(10),
  resource_snapshot: z.string().min(12),
  preferred_formats: z.array(z.enum(["physical", "digital", "investigative", "creative", "community", "venture"])).max(6),
  open_to_anything: z.boolean(),
  existing_skills: z.array(z.string().min(1)).max(20),
  field_practices: z.array(z.string().min(4)).min(1).max(6),
  scope_risks: z.array(z.string().min(4)).min(1).max(6),
  safety_ethics_considerations: z.array(z.string().min(4)).max(8),
  anti_generic_warnings: z.array(z.string().min(6)).min(2).max(6),
  scope_guardrails: z.array(z.string().min(3)).min(2).max(6),
  focus_signal: z.string().min(12),
  project_goal: z.string().min(3),
  constraints_summary: z.string().min(3),
  weekly_hours: z.number().int().min(1).max(80),
  completion_date: z.string().nullable(),
  preferred_challenge: DifficultySchema,
});

export const GenerationContextSchema = z.object({
  summary: z.string().min(24),
  interpreted_interests: z.array(z.string().min(2)).min(1).max(8),
  skill_assessment: SkillAssessmentSchema,
  risk_flags: z.array(RiskFlagSchema).max(7),
  project_context_json: ProjectContextPayloadSchema,
});

export const RepositoryRelevanceSchema = z.enum(["recommended", "optional", "not_needed"]);

const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/u;

export const ProjectBlueprintSchema = z.object({
  central_challenge: z.string().min(16).max(260),
  approach: z.string().min(16).max(320),
  primary_artifacts: z.array(z.string().min(3).max(140)).min(1).max(6),
  proof_of_success: z.array(z.string().min(8).max(200)).min(2).max(6),
  scope_boundary: z.string().min(16).max(260),
  resources_needed: z.array(z.string().min(2).max(120)).min(1).max(8),
  safety_ethics_notes: z.array(z.string().min(4).max(220)).max(8),
});

const BaseProjectOptionSchema = z.object({
  id: z.string().min(2).max(80),
  title: z.string().min(5).max(120),
  summary: z.string().min(40).max(340),
  why_it_fits: z.string().min(24).max(360),
  project_kind_label: z.string().min(3).max(80),
  repository_relevance: RepositoryRelevanceSchema,
  difficulty: DifficultySchema,
  estimated_weeks: z.number().int().min(2).max(20),
  skills_demonstrated: z.array(z.string().min(2).max(60)).min(2).max(8),
  tools_needed: z.array(z.string().min(2).max(60)).min(2).max(8),
  impressiveness_score: z.number().int().min(1).max(10),
  finishability_score: z.number().int().min(1).max(10),
  project_blueprint_json: ProjectBlueprintSchema,
  grounding_sources: z.array(z.object({
    title: z.string().min(2).max(160),
    // OpenAI structured outputs reject Zod's `format: "uri"`. A pattern keeps
    // the provider schema supported while still limiting sources to HTTP(S).
    url: z.string().max(1000).regex(HTTP_URL_PATTERN),
  })).max(8),
});

export const ProjectOptionSchema = BaseProjectOptionSchema;

export const RecommendationBatchSchema = z.object({
  recommendations: z.array(ProjectOptionSchema).length(3),
});

export const RoadmapStepSchema = z.object({
  order_index: z.number().int().min(0),
  title: z.string().min(6).max(120),
  objective: z.string().min(18).max(220),
  deliverable: z.string().min(12).max(180),
  rough_time_estimate: z.string().min(4).max(60),
  validation_check: z.string().min(12).max(220),
  scope_guardrail: z.string().min(12).max(220),
});

export const PitchKitTalkingPointSchema = z.object({
  label: z.string().min(4).max(40),
  body: z.string().min(40).max(300),
});

/**
 * How the student talks about the project. Generated with the roadmap rather than
 * stitched from templates afterwards, so the prose is written as prose and gets
 * the same schema validation and repair-retry as the rest of the roadmap.
 */
export const PitchKitSchema = z.object({
  elevator_pitch: z.string().min(80).max(400),
  resume_bullets: z.array(z.string().min(60).max(220)).min(2).max(3),
  talking_points: z.array(PitchKitTalkingPointSchema).min(3).max(3),
});

const HTTP_RESOURCE_URL_PATTERN = /^https?:\/\/[^\s]+$/u;

function isValidHttpResourceUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export const LearningResourceSchema = z.object({
  title: z.string().min(4).max(140),
  provider: z.string().min(2).max(80),
  url: z
    .string()
    // OpenAI Structured Outputs does not support JSON Schema format: "uri".
    // `regex` becomes the supported `pattern` keyword; the refinement below
    // retains full application-side URL parsing after the response is decoded.
    .regex(HTTP_RESOURCE_URL_PATTERN, "Resource URL must use HTTP(S).")
    .max(1000)
    .refine(isValidHttpResourceUrl, "Resource URL must be a valid HTTP(S) URL."),
  resource_type: z.enum(["documentation", "course", "tutorial", "paper", "dataset", "tool", "reference"]),
  learning_stage: z.enum(["start_here", "build_with", "go_deeper"]),
  why_it_matters: z.string().min(24).max(260),
  use_during_step: z.number().int().min(1).max(6),
  free_access: z.boolean(),
});

export const RoadmapOverviewSchema = z.object({
  project_title: z.string().min(5).max(140),
  short_overview: z.string().min(40).max(320),
  project_brief: z.string().min(60).max(600),
  core_scope: z.string().min(30).max(600),
  artifact_plan: z.array(z.object({
    artifact: z.string().min(3).max(120),
    purpose: z.string().min(12).max(240),
  })).min(1).max(8),
  project_overview_draft: z.string().min(80).max(1600),
  steps: z.array(RoadmapStepSchema).min(4).max(6),
  cut_if_behind: z.array(z.string().min(8).max(180)).min(1).max(4),
  success_criteria: z.array(z.string().min(8).max(180)).min(2).max(5),
  /**
   * Optional on the shared type because roadmaps stored before the pitch kit
   * existed are rehydrated through this schema. Generation requires it — see
   * `RoadmapGenerationSchema`.
   */
  pitch_kit: PitchKitSchema.nullish(),
  /** Older stored roadmaps predate the learning library. */
  learning_resources: z.array(LearningResourceSchema).min(3).max(8).nullish(),
});

/** The roadmap contract for generation: the pitch kit is mandatory. */
export const RoadmapGenerationSchema = RoadmapOverviewSchema.extend({
  pitch_kit: PitchKitSchema,
  learning_resources: z.array(LearningResourceSchema).min(5).max(8),
});

export const StepGuidanceEmailSchema = z.object({
  subject: z.string().min(5).max(120),
  preview: z.string().min(12).max(200),
  body: z.string().min(40).max(1200),
});

export const StepGuidanceSchema = z.object({
  what_to_do_now: z.string().min(40).max(260),
  checklist: z.array(z.string().min(8).max(180)).min(4).max(8),
  pitfalls: z.array(z.string().min(8).max(180)).min(2).max(5),
  tools_resources: z.array(z.string().min(4).max(180)).min(3).max(6),
  done_when: z.array(z.string().min(8).max(180)).min(2).max(4),
  encouragement: z.string().min(24).max(220),
  email_version: StepGuidanceEmailSchema,
});

const CriterionVerdictSchema = z.object({
  criterion: z.string().min(5).max(240),
  verdict: z.enum(["met", "pass", "partial", "not_yet"]),
  note: z.string().min(10).max(300),
});

const ScopeAssessmentSchema = z.object({
  drifted: z.boolean(),
  out_of_scope_note: z.string().min(10).max(300).nullable(),
});

export const WorkEvaluationSchema = z.object({
  criterion_verdicts: z.array(CriterionVerdictSchema).min(1).max(6),
  overall_assessment: z.string().min(40).max(500),
  strongest_aspect: z.string().min(10).max(200),
  clearest_gap: z.string().min(10).max(200),
  next_best_action: z.string().min(10).max(300),
  ready_to_mark_complete: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  scope_assessment: ScopeAssessmentSchema.optional().nullable(),
  evidence_reviewed: z.array(z.string().min(3).max(200)).min(1).max(12),
  evidence_limitations: z.array(z.string().min(3).max(260)).max(12),
});

export const WorkPortfolioCurationSchema = z.object({
  curated_summary: z.string().min(80).max(700),
});

export const CommonAppActivitySchema = z.object({
  activity_type: z.string().min(4).max(80),
  position_leadership_description: z.string().min(5).max(50),
  organization_name: z.string().min(3).max(100),
  participation_grade_levels: z.string().min(2).max(80),
  timing_of_participation: z.string().min(4).max(100),
  hours_per_week: z.number().int().min(0).max(80),
  weeks_per_year: z.number().int().min(0).max(52),
  details: z.string().min(80).max(150),
});

export const ResumeBulletsSchema = z.object({
  bullets: z.array(z.string().min(50).max(220)).min(2).max(4),
});

export type GenerationContext = z.infer<typeof GenerationContextSchema>;
export type RecommendationBatch = z.infer<typeof RecommendationBatchSchema>;
export type ProjectOption = z.infer<typeof ProjectOptionSchema>;
export type RoadmapOverview = z.infer<typeof RoadmapOverviewSchema>;
export type RoadmapStep = z.infer<typeof RoadmapStepSchema>;
export type PitchKit = z.infer<typeof PitchKitSchema>;
export type PitchKitTalkingPoint = z.infer<typeof PitchKitTalkingPointSchema>;
export type LearningResource = z.infer<typeof LearningResourceSchema>;
export type StepGuidance = z.infer<typeof StepGuidanceSchema>;
export type WorkEvaluation = z.infer<typeof WorkEvaluationSchema>;
export type WorkPortfolioCuration = z.infer<typeof WorkPortfolioCurationSchema>;
export type CommonAppActivity = z.infer<typeof CommonAppActivitySchema>;
export type ResumeBullets = z.infer<typeof ResumeBulletsSchema>;
