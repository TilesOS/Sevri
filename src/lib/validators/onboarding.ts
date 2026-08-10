import { z } from "zod";

export const projectFormatPreferenceSchema = z.enum([
  "physical",
  "digital",
  "investigative",
  "creative",
  "community",
  "venture",
]);

export const projectGoalSchema = z.enum([
  "learning",
  "portfolio",
  "college_applications",
  "internship_or_job",
  "class_or_capstone",
  "competition",
  "community_impact",
  "personal",
  "other",
]);

/**
 * Required free-text answers are trimmed before they are measured, so a field
 * holding only spaces is empty rather than "long enough". Optional fields are
 * trimmed too, which keeps whitespace-only notes out of the generation prompt.
 */
const requiredText = (label: string) => z.string().trim().min(2, `${label} is required.`);

export const onboardingInputSchema = z.object({
  student_stage: requiredText("Student stage"),
  project_goal: projectGoalSchema,
  success_definition: requiredText("Your definition of success").max(500),
  interests: z.array(z.string().trim().min(1)).min(1, "Add at least one interest."),
  favorite_subjects: z.array(z.string().trim().min(1)).min(1, "Add at least one favorite subject."),
  open_to_anything: z.boolean().default(true),
  format_preferences: z.array(projectFormatPreferenceSchema).max(6).default([]),
  preference_notes: z.string().trim().max(500).optional(),
  experience_level: z.enum(["beginner", "intermediate", "advanced"]),
  existing_skills: z.array(z.string().trim().min(1)).max(20).default([]),
  available_resources: z.string().trim().max(1000).optional(),
  weekly_time_available: z.number().int().min(1).max(80),
  completion_date: z.string().date().optional().or(z.literal("")),
  budget_constraints: z.string().trim().max(500).optional(),
  preferred_challenge: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
  other_constraints: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  if (!value.open_to_anything && value.format_preferences.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.too_small,
      minimum: 1,
      type: "array",
      inclusive: true,
      message: "Choose at least one project format or stay open to anything.",
      path: ["format_preferences"],
    });
  }
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
export type ProjectFormatPreference = z.infer<typeof projectFormatPreferenceSchema>;
export type ProjectGoal = z.infer<typeof projectGoalSchema>;
