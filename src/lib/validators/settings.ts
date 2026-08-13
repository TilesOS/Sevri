import { z } from "zod";
import { projectGoalSchema } from "@/lib/validators/onboarding";

export const studentStageSchema = z.enum([
  "high_school_freshman",
  "high_school_sophomore",
  "high_school_junior",
  "high_school_senior",
  "college_freshman",
  "college_sophomore",
  "college_junior",
  "college_senior",
  "other",
]);

export const settingsProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Please enter your name.")
    .max(80, "Name must be 80 characters or fewer."),
  student_stage: studentStageSchema,
  project_goal: projectGoalSchema,
});

export type SettingsProfileInput = z.infer<typeof settingsProfileSchema>;

export const studentStageOptions: Array<{
  value: z.infer<typeof studentStageSchema>;
  label: string;
}> = [
  { value: "high_school_freshman", label: "High school freshman" },
  { value: "high_school_sophomore", label: "High school sophomore" },
  { value: "high_school_junior", label: "High school junior" },
  { value: "high_school_senior", label: "High school senior" },
  { value: "college_freshman", label: "College freshman" },
  { value: "college_sophomore", label: "College sophomore" },
  { value: "college_junior", label: "College junior" },
  { value: "college_senior", label: "College senior" },
  { value: "other", label: "Other" },
];

export const projectGoalOptions: Array<{
  value: z.infer<typeof projectGoalSchema>;
  label: string;
}> = [
  { value: "learning", label: "Learning" },
  { value: "portfolio", label: "Portfolio" },
  { value: "college_applications", label: "College applications" },
  { value: "internship_or_job", label: "Internship or job" },
  { value: "class_or_capstone", label: "Class or capstone" },
  { value: "competition", label: "Competition" },
  { value: "community_impact", label: "Community impact" },
  { value: "personal", label: "Personal goal" },
  { value: "other", label: "Other" },
];

/** Kept as a temporary import alias while settings consumers move together. */
