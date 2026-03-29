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

export const DifficultySchema = z.enum([
  "beginner",
  "beginner_intermediate",
  "intermediate",
  "intermediate_advanced",
]);

const CommonGenerationContextPayloadSchema = z.object({
  domain_brief: z.string().min(30),
  anchor_interests: z.array(z.string().min(2)).min(1).max(8),
  goal_signal: z.string().min(12),
  resource_snapshot: z.string().min(12),
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
  mentor_resource_notes: z.string().min(8),
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
  summary: z.string().min(40).max(260),
  why_it_fits: z.string().min(24).max(220),
  difficulty: DifficultySchema,
  estimated_weeks: z.number().int().min(2).max(20),
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

export const RoadmapOverviewSchema = z.object({
  project_title: z.string().min(5).max(140),
  short_overview: z.string().min(40).max(320),
  project_brief: z.string().min(60).max(600),
  steps: z.array(RoadmapStepSchema).min(4).max(6),
  cut_if_behind: z.array(z.string().min(8).max(180)).min(1).max(4),
  success_criteria: z.array(z.string().min(8).max(180)).min(2).max(5),
});

export const StepGuidanceEmailSchema = z.object({
  subject: z.string().min(5).max(120),
  preview: z.string().min(12).max(200),
  body: z.string().min(40).max(1200),
});

export const StepGuidanceSchema = z.object({
  what_to_do_now: z.string().min(40).max(260),
  checklist: z.array(z.string().min(8).max(180)).min(4).max(8),
  deliverables: z.array(z.string().min(6).max(180)).min(2).max(5),
  pitfalls: z.array(z.string().min(8).max(180)).min(2).max(5),
  tools_resources: z.array(z.string().min(4).max(180)).min(3).max(6),
  done_when: z.array(z.string().min(8).max(180)).min(2).max(4),
  encouragement: z.string().min(24).max(220),
  email_version: StepGuidanceEmailSchema,
});

export type ProjectTrack = z.infer<typeof ProjectTrackSchema>;
export type GenerationContext = z.infer<typeof GenerationContextSchema>;
export type RecommendationBatch = z.infer<typeof RecommendationBatchSchema>;
export type ProjectOption = z.infer<typeof ProjectOptionSchema>;
export type RoadmapOverview = z.infer<typeof RoadmapOverviewSchema>;
export type RoadmapStep = z.infer<typeof RoadmapStepSchema>;
export type StepGuidance = z.infer<typeof StepGuidanceSchema>;
