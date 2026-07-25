import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { RATE_LIMITED_MESSAGE } from "@/lib/errors/user-messages";
import { buildGenerationContext } from "@/lib/ai/generation-context";
import { withProfileIdentity } from "@/lib/ai/intake-identity";
import { captureServerError } from "@/lib/sentry/server";
import { getProfileIdentity } from "@/lib/db/queries/profile";
import { getLatestProjectTrack } from "@/lib/db/queries/recommendations";
import { getGenerationVersion } from "@/lib/ai/client";
import type { ProjectTrack } from "@/lib/validators/onboarding";

export const runtime = "nodejs";

const bodySchema = z.object({
  project_track: z.enum(["software", "research"]).optional(),
});

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function asProjectTrack(value: unknown): ProjectTrack {
  return value === "research" ? "research" : "software";
}

export async function POST(request: Request) {
  let stage = "start";
  try {
    stage = "auth";
    const { user, response } = await requireApiUser();
    if (!user) {
      return response;
    }

    stage = "parse-request";
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    stage = "rate-limit";
    try {
      const rateLimit = await enforceRateLimit({
        userId: user.id,
        endpoint: "normalize-profile",
        maxRequests: 10,
        windowMinutes: 60,
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: RATE_LIMITED_MESSAGE, code: "rate_limited", reset_at: rateLimit.resetAt },
          { status: 429 },
        );
      }
    } catch (rateLimitError) {
      console.error("normalize-profile rate-limit failed", { stage, error: rateLimitError });
      captureServerError(rateLimitError, {
        route: "ai/normalize-profile",
        stage: "rate-limit",
      });
    }

    stage = "create-supabase-client";
    const supabase = await createServerSupabaseClient();

    stage = "resolve-project-track";
    const requestedTrack = body.project_track ?? (await getLatestProjectTrack(user.id));

    stage = "fetch-intake";
    const { data: intake, error: intakeError } = await supabase
      .from("intakes")
      .select("id, raw_answers_json, project_track")
      .eq("user_id", user.id)
      .eq("project_track", requestedTrack)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intakeError || !intake) {
      return NextResponse.json({ error: `Complete ${requestedTrack} onboarding first` }, { status: 400 });
    }

    const projectTrack = asProjectTrack(intake.project_track);

    stage = "resolve-profile-identity";
    // Stage comes from the profile, not from this track's saved intake, so both
    // tracks describe the same student.
    const identity = await getProfileIdentity(user.id).catch(() => ({ studentStage: null }));

    stage = "build-context";
    const normalized = buildGenerationContext({
      projectTrack,
      rawIntake: withProfileIdentity((intake.raw_answers_json as Record<string, unknown>) ?? {}, identity),
    });

    stage = "insert-context";
    const { data, error } = await supabase
      .from("normalized_profiles")
      .insert({
        user_id: user.id,
        intake_id: intake.id,
        project_track: normalized.project_track,
        summary: normalized.summary,
        interpreted_interests: normalized.interpreted_interests,
        skill_assessment: normalized.skill_assessment,
        risk_flags: normalized.risk_flags,
        track_payload_json: normalized.track_payload_json,
        raw_model_output_json: {
          source: "deterministic-context",
          generation_version: getGenerationVersion(),
          context: normalized,
        },
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ normalized_profile_id: data.id, ...normalized }, { status: 200 });
  } catch (error) {
    console.error("normalize-profile failed", { stage, error });
    captureServerError(error, { route: "ai/normalize-profile", stage });
    const details = getErrorDetails(error);
    const status = error instanceof z.ZodError && stage === "parse-request" ? 400 : 500;
    return NextResponse.json(
      {
        error: status === 400 ? "Invalid request payload" : "Failed to build generation context",
        stage,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status },
    );
  }
}
