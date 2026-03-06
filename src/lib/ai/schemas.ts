import { z } from "zod";

export const RiskFlagSchema = z.enum([
  "too_ambitious",
  "too_vague",
  "too_advanced",
  "too_little_time",
  "misaligned_goal",
]);

export const NormalizedProfileSchema = z.object({
  summary: z.string().min(40),
  interpreted_interests: z.array(z.string().min(2)).min(1).max(10),
  skill_assessment: z.enum(["beginner", "intermediate", "advanced"]),
  risk_flags: z.array(RiskFlagSchema).max(5),
});

export const ProjectRecommendationSchema = z.object({
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

export const RecommendationBatchSchema = z.object({
  recommendations: z.array(ProjectRecommendationSchema).length(3),
});

export const MilestoneSchema = z.object({
  order_index: z.number().int().min(0),
  title: z.string().min(4),
  description: z.string().min(10),
});

export const RoadmapSchema = z.object({
  overview: z.string().min(50),
  mvp_scope: z.string().min(50),
  feature_ladder: z.object({
    must_have: z.array(z.string()).min(2),
    should_have: z.array(z.string()).min(1),
    could_have: z.array(z.string()).min(1),
  }),
  milestones: z.array(MilestoneSchema).min(3).max(10),
  repo_structure: z
    .array(
      z.object({
        path: z.string().min(1),
        purpose: z.string().min(5),
      }),
    )
    .min(5),
  readme_draft: z.string().min(120),
  cut_if_behind: z.array(z.string()).min(2),
  stretch_goals: z.array(z.string()).min(2),
  explanation_guide: z.object({
    elevator_pitch: z.string().min(30),
    resume_bullets: z.array(z.string()).min(2).max(5),
    interview_talking_points: z.array(z.string()).min(3).max(8),
  }),
});

export type NormalizedProfile = z.infer<typeof NormalizedProfileSchema>;
export type RecommendationBatch = z.infer<typeof RecommendationBatchSchema>;
export type Roadmap = z.infer<typeof RoadmapSchema>;