import type { ProfileIdentity } from "@/lib/db/queries/profile";

/**
 * Overlays the profile's identity facts onto a stored intake before generation
 * reads it.
 *
 * Intake rows keep whatever `student_stage` they were saved with, which is
 * useful history but wrong as an input: a student's stage is one fact, and two
 * intakes could disagree about it. Every generation path resolves it here so the
 * multiple generations cannot describe the same student differently.
 */
export function withProfileIdentity(
  rawIntake: Record<string, unknown>,
  identity: ProfileIdentity,
): Record<string, unknown> {
  if (!identity.studentStage) {
    // No profile answer to apply — leave the intake's own copy alone rather than
    // dropping the field and telling the model nothing about the student's stage.
    return rawIntake;
  }

  return { ...rawIntake, student_stage: identity.studentStage };
}
