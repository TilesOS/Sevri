import { createServerSupabaseClient } from "@/lib/supabase/server";
import { studentStageSchema } from "@/lib/validators/settings";
import type { StudentStage } from "@/types/domain";

/**
 * Stable student identity belongs on the profile; each intake carries the
 * project-specific context. Anything that reads a stage should read it here.
 */
export interface ProfileIdentity {
  studentStage: StudentStage | null;
}

function asStudentStage(value: unknown): StudentStage | null {
  const parsed = studentStageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function getProfileIdentity(userId: string): Promise<ProfileIdentity> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("student_stage")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch profile identity: ${error.message}`);
  }

  return { studentStage: asStudentStage(data?.student_stage) };
}
