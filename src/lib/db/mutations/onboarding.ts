import { createServerSupabaseClient } from "@/lib/supabase/server";
import { onboardingInputSchema, type OnboardingInput } from "@/lib/validators/onboarding";

export { onboardingInputSchema };
export type { OnboardingInput };

export async function upsertOnboardingData(userId: string, input: OnboardingInput) {
  const supabase = await createServerSupabaseClient();

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      full_name: input.full_name,
      student_stage: input.student_stage,
      target_outcome: input.target_outcome,
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    throw new Error(`Failed to upsert profile: ${profileError.message}`);
  }

  const { data: intake, error: intakeError } = await supabase
    .from("intakes")
    .insert({
      user_id: userId,
      interests: input.interests,
      favorite_subjects: input.favorite_subjects,
      coding_experience: input.coding_experience,
      weekly_time_available: input.weekly_time_available,
      preferred_project_style: input.preferred_project_style,
      known_tools: input.known_tools,
      target_schools_or_companies: input.target_schools_or_companies,
      preferred_difficulty: input.preferred_difficulty,
      constraints: input.constraints ?? null,
      raw_answers_json: input,
    })
    .select("id")
    .single();

  if (intakeError) {
    throw new Error(`Failed to insert intake: ${intakeError.message}`);
  }

  return intake;
}