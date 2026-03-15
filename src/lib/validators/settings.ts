import { z } from "zod";
import { projectTrackSchema, targetOutcomeSchema } from "@/lib/validators/onboarding";

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
  target_outcome: targetOutcomeSchema,
  project_track: projectTrackSchema,
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

export const targetOutcomeOptions: Array<{
  value: z.infer<typeof targetOutcomeSchema>;
  label: string;
}> = [
  { value: "college_apps", label: "College applications" },
  { value: "internship", label: "Internship" },
  { value: "portfolio", label: "Portfolio" },
  { value: "learning", label: "Learning" },
];

export const projectTrackOptions: Array<{
  value: z.infer<typeof projectTrackSchema>;
  label: string;
}> = [
  { value: "software", label: "Software" },
  { value: "research", label: "Research" },
];
