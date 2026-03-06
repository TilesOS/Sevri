import { z } from "zod";

export const onboardingInputSchema = z.object({
  full_name: z.string().min(2),
  student_stage: z.string().min(2),
  target_outcome: z.enum(["college_apps", "internship", "portfolio", "learning"]),
  interests: z.array(z.string().min(2)).min(1),
  favorite_subjects: z.array(z.string().min(2)).min(1),
  coding_experience: z.enum(["beginner", "intermediate", "advanced"]),
  weekly_time_available: z.number().int().min(1).max(80),
  preferred_project_style: z.string().min(2),
  known_tools: z.array(z.string()).default([]),
  target_schools_or_companies: z.array(z.string()).default([]),
  preferred_difficulty: z.enum(["beginner", "beginner_intermediate", "intermediate", "intermediate_advanced"]),
  constraints: z.string().optional(),
  additional_context: z.string().optional(),
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;