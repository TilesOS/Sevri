import { getProfileIdentity } from "@/lib/db/queries/profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { onboardingInputSchema, type OnboardingInput } from "@/lib/validators/onboarding";
import type { StudentStage } from "@/types/domain";

export interface LatestOnboardingAnswers {
  answers: OnboardingInput | null;
  profileStudentStage: StudentStage | null;
}

export async function getLatestOnboardingAnswers(userId: string): Promise<LatestOnboardingAnswers> {
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, identity] = await Promise.all([
    supabase
      .from("intakes")
      .select("raw_answers_json")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getProfileIdentity(userId).catch(() => ({ studentStage: null })),
  ]);

  if (error) {
    throw new Error(`Failed to fetch onboarding answers: ${error.message}`);
  }

  const parsed = onboardingInputSchema.safeParse(data?.raw_answers_json);
  return {
    answers: parsed.success ? parsed.data : null,
    profileStudentStage: identity.studentStage,
  };
}
