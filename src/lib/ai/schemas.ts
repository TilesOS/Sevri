import { z } from "zod";

export const ProjectTrackSchema = z.enum(["software", "research"]);

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

const CommonGenerationContextPayloadSchema = z.object({
  domain_brief: z.string().min(30),
  anchor_interests: z.array(z.string().min(2)).min(1).max(8),
  goal_signal: z.string().min(12),
  resource_snapshot: z.string().min(12),
  anti_generic_warnings: z.array(z.string().min(6)).min(2).max(6),
  scope_guardrails: z.array(z.string().min(3)).min(2).max(6),
  focus_signal: z.string().min(12),
  target_outcome: z.string().min(3),
  constraints_summary: z.string().min(3),
  weekly_hours: z.number().int().min(1).max(80),
});

const SoftwareGenerationContextPayloadSchema = CommonGenerationContextPayloadSchema.extend({
  project_style_fit: z.string().min(8),
  problem_lenses: z.array(z.string().min(4)).min(2).max(4),
  delivery_bias: z.string().min(8),
});

const ResearchGenerationContextPayloadSchema = CommonGenerationContextPayloadSchema.extend({
  research_readiness: z.string().min(8),
  methodology_guidance: z.string().min(8),
  viable_methodologies: z.array(z.string().min(4)).min(2).max(4),
});

export const SoftwareGenerationContextSchema = z.object({
  project_track: z.literal("software"),
  summary: z.string().min(24),
  interpreted_interests: z.array(z.string().min(2)).min(1).max(8),
  skill_assessment: SkillAssessmentSchema,
  risk_flags: z.array(RiskFlagSchema).max(7),
  track_payload_json: SoftwareGenerationContextPayloadSchema,
});

export const ResearchGenerationContextSchema = z.object({
  project_track: z.literal("research"),
  summary: z.string().min(24),
  interpreted_interests: z.array(z.string().min(2)).min(1).max(8),
  skill_assessment: SkillAssessmentSchema,
  risk_flags: z.array(RiskFlagSchema).max(7),
  track_payload_json: ResearchGenerationContextPayloadSchema,
});

export const GenerationContextSchema = z.discriminatedUnion("project_track", [
  SoftwareGenerationContextSchema,
  ResearchGenerationContextSchema,
]);

const SoftwareOptionSeedSchema = z.object({
  target_user: z.string().min(10).max(140),
  problem_statement: z.string().min(16).max(220),
  core_workflow: z.string().min(16).max(220),
  mvp_boundary: z.string().min(16).max(220),
  validation_plan: z.string().min(16).max(220),
});

const ResearchOptionSeedSchema = z.object({
  research_question: z.string().min(16).max(220),
  hypothesis_or_focus: z.string().min(16).max(220),
  methodology: z.string().min(8).max(180),
  evidence_plan: z.string().min(8).max(180),
  scope_boundaries: z.string().min(12).max(220),
  limitation_note: z.string().min(12).max(220),
});

const BaseProjectOptionSchema = z.object({
  id: z.string().min(2).max(80),
  title: z.string().min(5).max(120),
  summary: z.string().min(40).max(340),
  why_it_fits: z.string().min(24).max(360),
  difficulty: DifficultySchema,
  estimated_weeks: z.number().int().min(2).max(20),
  skills_demonstrated: z.array(z.string().min(2).max(60)).min(2).max(8),
  tools_needed: z.array(z.string().min(2).max(60)).min(2).max(8),
  impressiveness_score: z.number().int().min(1).max(10),
  finishability_score: z.number().int().min(1).max(10),
});

export const SoftwareProjectOptionSchema = BaseProjectOptionSchema.extend({
  project_track: z.literal("software"),
  track_payload_json: SoftwareOptionSeedSchema,
});

export const ResearchProjectOptionSchema = BaseProjectOptionSchema.extend({
  project_track: z.literal("research"),
  track_payload_json: ResearchOptionSeedSchema,
});

export const ProjectOptionSchema = z.discriminatedUnion("project_track", [
  SoftwareProjectOptionSchema,
  ResearchProjectOptionSchema,
]);

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

export const RoadmapOverviewSchema = z.object({
  project_title: z.string().min(5).max(140),
  short_overview: z.string().min(40).max(320),
  project_brief: z.string().min(60).max(600),
  steps: z.array(RoadmapStepSchema).min(4).max(6),
  cut_if_behind: z.array(z.string().min(8).max(180)).min(1).max(4),
  success_criteria: z.array(z.string().min(8).max(180)).min(2).max(5),
  /**
   * Optional on the shared type because roadmaps stored before the pitch kit
   * existed are rehydrated through this schema. Generation requires it — see
   * `RoadmapGenerationSchema`.
   */
  pitch_kit: PitchKitSchema.nullish(),
});

/** The roadmap contract for generation: the pitch kit is mandatory. */
export const RoadmapGenerationSchema = RoadmapOverviewSchema.extend({
  pitch_kit: PitchKitSchema,
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

export type ProjectTrack = z.infer<typeof ProjectTrackSchema>;
export type GenerationContext = z.infer<typeof GenerationContextSchema>;
export type RecommendationBatch = z.infer<typeof RecommendationBatchSchema>;
export type ProjectOption = z.infer<typeof ProjectOptionSchema>;
export type RoadmapOverview = z.infer<typeof RoadmapOverviewSchema>;
export type RoadmapStep = z.infer<typeof RoadmapStepSchema>;
export type PitchKit = z.infer<typeof PitchKitSchema>;
export type PitchKitTalkingPoint = z.infer<typeof PitchKitTalkingPointSchema>;
export type StepGuidance = z.infer<typeof StepGuidanceSchema>;
export type WorkEvaluation = z.infer<typeof WorkEvaluationSchema>;
export type WorkPortfolioCuration = z.infer<typeof WorkPortfolioCurationSchema>;
export type CommonAppActivity = z.infer<typeof CommonAppActivitySchema>;
export type ResumeBullets = z.infer<typeof ResumeBulletsSchema>;
