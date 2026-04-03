import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveStoredFullName } from "@/lib/auth/names";
import {
  onboardingInputSchema,
  type OnboardingInput,
  type ResearchOnboardingInput,
  type SoftwareOnboardingInput,
} from "@/lib/validators/onboarding";

export { onboardingInputSchema };
export type { OnboardingInput };

function getSoftwareTrackPayload(input: SoftwareOnboardingInput) {
  return {
    coding_experience: input.coding_experience,
    preferred_project_style: input.preferred_project_style,
    known_tools: input.known_tools,
  };
}

function getResearchTrackPayload(input: ResearchOnboardingInput) {
  return {
    preferred_research_domain: input.preferred_research_domain,
    research_experience: input.research_experience,
    methodology_preference: input.methodology_preference,
    target_research_deliverable: input.target_research_deliverable,
    data_or_resource_access: input.data_or_resource_access ?? null,
  };
}

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

  const resolvedFullName = resolveStoredFullName({
    profileFullName: existingProfile?.full_name,
    userMetadata: user.user_metadata,
    email: user.email,
  });

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      full_name: resolvedFullName,
      student_stage: input.student_stage,
      target_outcome: input.target_outcome,
      project_track: input.project_track,
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    throw new Error(`Failed to upsert profile: ${profileError.message}`);
  }

  const intakeInsert =
    input.project_track === "software"
      ? {
          user_id: user.id,
          project_track: input.project_track,
          interests: input.interests,
          favorite_subjects: input.favorite_subjects,
          coding_experience: input.coding_experience,
          weekly_time_available: input.weekly_time_available,
          preferred_project_style: input.preferred_project_style,
          known_tools: input.known_tools,
          target_schools_or_companies: [],
          preferred_difficulty: null,
          constraints: input.constraints ?? null,
          track_payload_json: getSoftwareTrackPayload(input),
          raw_answers_json: input,
        }
      : {
          user_id: user.id,
          project_track: input.project_track,
          interests: input.interests,
          favorite_subjects: input.favorite_subjects,
          coding_experience: null,
          weekly_time_available: input.weekly_time_available,
          preferred_project_style: null,
          known_tools: [],
          target_schools_or_companies: [],
          preferred_difficulty: null,
          constraints: input.constraints ?? null,
          track_payload_json: getResearchTrackPayload(input),
          raw_answers_json: input,
        };

  const { data: intake, error: intakeError } = await supabase
    .from("intakes")
    .insert(intakeInsert)
    .select("id, project_track")
    .single();

  if (intakeError) {
    throw new Error(`Failed to insert intake: ${intakeError.message}`);
  }

  return intake;
}
