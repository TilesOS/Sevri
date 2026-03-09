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

const SoftwareNormalizedTrackPayloadSchema = z
  .object({
    project_style_fit: z.string().min(20),
    scope_guardrails: z.array(z.string().min(3)).min(2).max(8),
  })
  .default({
    project_style_fit: "Focus on one strong software workflow with clear portfolio impact.",
    scope_guardrails: ["Keep MVP narrow", "Cut advanced features if timeline slips"],
  });

const ResearchNormalizedTrackPayloadSchema = z.object({
  research_readiness: z.string().min(30),
  scope_guardrails: z.array(z.string().min(3)).min(2).max(8),
  mentor_resource_notes: z.string().min(20),
});

export const SoftwareNormalizedProfileSchema = z.object({
  project_track: z.literal("software"),
  summary: z.string().min(40),
  interpreted_interests: z.array(z.string().min(2)).min(1).max(10),
  skill_assessment: z.enum(["beginner", "intermediate", "advanced"]),
  risk_flags: z.array(RiskFlagSchema).max(7),
  track_payload_json: SoftwareNormalizedTrackPayloadSchema,
});

export const ResearchNormalizedProfileSchema = z.object({
  project_track: z.literal("research"),
  summary: z.string().min(40),
  interpreted_interests: z.array(z.string().min(2)).min(1).max(10),
  skill_assessment: z.enum(["beginner", "intermediate", "advanced"]),
  risk_flags: z.array(RiskFlagSchema).max(7),
  track_payload_json: ResearchNormalizedTrackPayloadSchema,
});

export const NormalizedProfileSchema = z.discriminatedUnion("project_track", [
  SoftwareNormalizedProfileSchema,
  ResearchNormalizedProfileSchema,
]);

const ProjectRecommendationBaseSchema = z.object({
  id: z.string().min(2),
  title: z.string().min(5).max(120),
  summary: z.string().min(50),
  rationale: z.string().min(40),
  difficulty: z.enum(["beginner", "beginner_intermediate", "intermediate", "intermediate_advanced"]),
  estimated_weeks: z.number().int().min(2).max(24),
  weekly_hours: z.number().int().min(2).max(25),
  skills_demonstrated: z.array(z.string().min(2)).min(3).max(12),
  tools_needed: z.array(z.string().min(2)).min(2).max(12),
  impressiveness_score: z.number().int().min(1).max(10),
  finishability_score: z.number().int().min(1).max(10),
  authenticity_note: z.string().min(20),
});

const SoftwareRecommendationTrackPayloadSchema = z
  .object({
    project_angle: z.string().min(20),
    portfolio_focus: z.string().min(20),
  })
  .default({
    project_angle: "Build and ship one focused software workflow.",
    portfolio_focus: "Show technical execution and product thinking with scoped delivery.",
  });

const ResearchRecommendationTrackPayloadSchema = z.object({
  project_title_or_direction: z.string().min(8),
  research_question_or_hypothesis: z.string().min(20),
  methodology: z.string().min(20),
  scope_boundaries: z.string().min(20),
  final_deliverables: z.array(z.string().min(3)).min(1).max(6),
  portfolio_or_application_positioning: z.string().min(20),
  key_risks: z.array(z.string().min(3)).min(2).max(6),
});

export const SoftwareProjectRecommendationSchema = ProjectRecommendationBaseSchema.extend({
  project_track: z.literal("software"),
  track_payload_json: SoftwareRecommendationTrackPayloadSchema,
});

export const ResearchProjectRecommendationSchema = ProjectRecommendationBaseSchema.extend({
  project_track: z.literal("research"),
  track_payload_json: ResearchRecommendationTrackPayloadSchema,
});

export const ProjectRecommendationSchema = z.discriminatedUnion("project_track", [
  SoftwareProjectRecommendationSchema,
  ResearchProjectRecommendationSchema,
]);

export const RecommendationBatchSchema = z.object({
  recommendations: z.array(ProjectRecommendationSchema).length(3),
});

export const MilestoneSchema = z.object({
  order_index: z.number().int().min(0),
  title: z.string().min(4),
  description: z.string().min(10),
});

const FeatureLadderSchema = z.object({
  must_have: z.array(z.string()).min(2),
  should_have: z.array(z.string()).min(1),
  could_have: z.array(z.string()).min(1),
});

const ExplanationGuideSchema = z.object({
  elevator_pitch: z.string().min(30),
  resume_bullets: z.array(z.string()).min(2).max(5),
  interview_talking_points: z.array(z.string()).min(3).max(8),
});

const BaseRoadmapSchema = z.object({
  overview: z.string().min(50),
  mvp_scope: z.string().min(50),
  feature_ladder: FeatureLadderSchema,
  milestones: z.array(MilestoneSchema).min(3).max(10),
  repo_structure: z
    .array(
      z.object({
        path: z.string().min(1),
        purpose: z.string().min(5),
      }),
    )
    .min(3),
  readme_draft: z.string().min(120),
  cut_if_behind: z.array(z.string()).min(2),
  stretch_goals: z.array(z.string()).min(2),
  explanation_guide: ExplanationGuideSchema,
});

const ResearchRoadmapTrackPayloadSchema = z.object({
  project_title_or_direction: z.string().min(8),
  why_this_fits: z.string().min(30),
  research_question_or_hypothesis: z.string().min(20),
  methodology: z.string().min(20),
  scope_boundaries: z.string().min(20),
  step_by_step_plan: z.array(z.string().min(8)).min(4).max(10),
  timeline_and_milestones: z.array(z.string().min(8)).min(3).max(10),
  risks_and_blockers: z.array(z.string().min(8)).min(2).max(8),
  final_deliverables: z.array(z.string().min(3)).min(1).max(6),
  portfolio_or_application_positioning: z.string().min(20),
});

export const SoftwareRoadmapSchema = BaseRoadmapSchema.extend({
  project_track: z.literal("software"),
  track_payload_json: z.record(z.unknown()).default({}),
});

export const ResearchRoadmapSchema = BaseRoadmapSchema.extend({
  project_track: z.literal("research"),
  track_payload_json: ResearchRoadmapTrackPayloadSchema,
});

export const RoadmapSchema = z.discriminatedUnion("project_track", [
  SoftwareRoadmapSchema,
  ResearchRoadmapSchema,
]);

export type ProjectTrack = z.infer<typeof ProjectTrackSchema>;
export type NormalizedProfile = z.infer<typeof NormalizedProfileSchema>;
export type RecommendationBatch = z.infer<typeof RecommendationBatchSchema>;
export type Roadmap = z.infer<typeof RoadmapSchema>;
