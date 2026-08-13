import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveStoredFullName } from "@/lib/auth/names";
import { onboardingInputSchema, type OnboardingInput } from "@/lib/validators/onboarding";
import type { Database } from "@/types/db";

export { onboardingInputSchema };
export type { OnboardingInput };

export async function upsertOnboardingData(user: User, input: OnboardingInput) {
  const supabase = await createServerSupabaseClient();
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingProfileError) {
    throw new Error(`Failed to load profile: ${existingProfileError.message}`);
  }

  const fullName = resolveStoredFullName({
    profileFullName: existingProfile?.full_name,
    userMetadata: user.user_metadata,
    email: user.email,
  });

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      full_name: fullName,
      student_stage: input.student_stage,
      project_goal: input.project_goal,
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    throw new Error(`Failed to upsert profile: ${profileError.message}`);
  }

  const intake: Database["public"]["Tables"]["intakes"]["Insert"] = {
    user_id: user.id,
    interests: input.interests,
    favorite_subjects: input.favorite_subjects,
    project_goal: input.project_goal,
    success_definition: input.success_definition,
    open_to_anything: input.open_to_anything,
    format_preferences: input.open_to_anything ? [] : input.format_preferences,
    preference_notes: input.preference_notes || null,
    experience_level: input.experience_level,
    existing_skills: input.existing_skills,
    available_resources: input.available_resources || null,
    weekly_time_available: input.weekly_time_available,
    completion_date: input.completion_date || null,
    budget_constraints: input.budget_constraints || null,
    preferred_challenge: input.preferred_challenge,
    other_constraints: input.other_constraints || null,
    raw_answers_json: input,
  };

  const { data, error } = await supabase
    .from("intakes")
    .insert(intake)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to insert intake: ${error.message}`);
  }

  return data;
}
