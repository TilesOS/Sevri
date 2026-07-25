import { getProfileIdentity } from "@/lib/db/queries/profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  onboardingInputSchema,
  type OnboardingInput,
  type ProjectTrack,
} from "@/lib/validators/onboarding";
import type { StudentStage } from "@/types/domain";

export type OnboardingAnswersByTrack = Partial<Record<ProjectTrack, OnboardingInput>>;

export interface LatestOnboardingAnswers {
  answersByTrack: OnboardingAnswersByTrack;
  initialProjectTrack: ProjectTrack;
  /**
   * Read from the profile, not from either intake. Stage is one fact about the
   * student, so the wizard shows the same answer on both tracks.
   */
  profileStudentStage: StudentStage | null;
}

function asProjectTrack(value: unknown): ProjectTrack | null {
  if (value === "software" || value === "research") {
    return value;
  }

  return null;
}

function parseStoredAnswers(rawAnswers: unknown, projectTrack: ProjectTrack) {
  if (!rawAnswers || typeof rawAnswers !== "object") {
    return null;
  }

  const parsed = onboardingInputSchema.safeParse({
    ...(rawAnswers as Record<string, unknown>),
    project_track: projectTrack,
  });

  return parsed.success ? parsed.data : null;
}

export async function getLatestOnboardingAnswers(userId: string): Promise<LatestOnboardingAnswers> {
  const supabase = await createServerSupabaseClient();

  const [{ data, error }, identity] = await Promise.all([
    supabase
      .from("intakes")
      .select("project_track, raw_answers_json")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    getProfileIdentity(userId).catch(() => ({ studentStage: null })),
  ]);

  if (error) {
    throw new Error(`Failed to fetch onboarding answers: ${error.message}`);
  }

  const answersByTrack: OnboardingAnswersByTrack = {};
  let initialProjectTrack: ProjectTrack | null = null;

  for (const row of data ?? []) {
    const projectTrack = asProjectTrack(row.project_track);

    if (!projectTrack) {
      continue;
    }

    if (answersByTrack[projectTrack]) {
      continue;
    }

    const storedAnswers = parseStoredAnswers(row.raw_answers_json, projectTrack);
    if (storedAnswers) {
      answersByTrack[projectTrack] = storedAnswers;
      initialProjectTrack ??= projectTrack;
    }

    if (answersByTrack.software && answersByTrack.research) {
      break;
    }
  }

  return {
    answersByTrack,
    initialProjectTrack: initialProjectTrack ?? "software",
    profileStudentStage: identity.studentStage,
  };
}
