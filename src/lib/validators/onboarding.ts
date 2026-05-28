import { z } from "zod";

export const projectTrackSchema = z.enum(["software", "research"]);

export const targetOutcomeSchema = z.enum(["college_apps", "internship", "portfolio", "learning"]);

const sharedOnboardingSchema = z.object({
  student_stage: z.string().min(2),
  target_outcome: targetOutcomeSchema,
  interests: z.array(z.string().min(2)).min(1),
  favorite_subjects: z.array(z.string().min(2)).min(1),
  weekly_time_available: z.number().int().min(1).max(80),
  constraints: z.string().optional(),
  additional_context: z.string().optional(),
});

export const softwareOnboardingInputSchema = sharedOnboardingSchema.extend({
  project_track: z.literal("software"),
  coding_experience: z.enum(["beginner", "intermediate", "advanced"]),
  preferred_project_style: z.string().min(2),
  known_tools: z.array(z.string()).default([]),
});

export const researchOnboardingInputSchema = sharedOnboardingSchema.extend({
  project_track: z.literal("research"),
  preferred_research_domain: z.string().min(2),
  research_experience: z.enum(["beginner", "intermediate", "advanced"]),
  methodology_preference: z.enum(["literature_review", "experiment", "data_analysis", "survey_based", "mixed"]),
  target_research_deliverable: z.enum([
    "paper",
    "poster",
    "presentation",
    "competition_submission",
    "portfolio_entry",
  ]),
  data_or_resource_access: z.string().optional(),
});

const onboardingUnionSchema = z.discriminatedUnion("project_track", [
  softwareOnboardingInputSchema,
  researchOnboardingInputSchema,
]);

export const onboardingInputSchema = z.preprocess((value) => {
  if (value && typeof value === "object" && !("project_track" in (value as Record<string, unknown>))) {
    return {
      ...(value as Record<string, unknown>),
      project_track: "software",
    };
  }

  return value;
}, onboardingUnionSchema);

export type SoftwareOnboardingInput = z.infer<typeof softwareOnboardingInputSchema>;
export type ResearchOnboardingInput = z.infer<typeof researchOnboardingInputSchema>;
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
export type ProjectTrack = z.infer<typeof projectTrackSchema>;
