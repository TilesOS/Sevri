import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { runProfileNormalization } from "@/lib/ai/pipelines";
import { captureServerError } from "@/lib/sentry/server";
import { getLatestProjectTrack } from "@/lib/db/queries/recommendations";
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
          { error: "Rate limit exceeded", reset_at: rateLimit.resetAt },
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

    stage = "run-normalization";
    const normalized = await runProfileNormalization({
      projectTrack,
      rawIntake: (intake.raw_answers_json as Record<string, unknown>) ?? {},
    });

    stage = "insert-normalized-profile";
    const { data, error } = await supabase
      .from("normalized_profiles")
      .insert({
        user_id: user.id,
        intake_id: intake.id,
        project_track: normalized.parsed.project_track,
        summary: normalized.parsed.summary,
        interpreted_interests: normalized.parsed.interpreted_interests,
        skill_assessment: normalized.parsed.skill_assessment,
        risk_flags: normalized.parsed.risk_flags,
        track_payload_json: normalized.parsed.track_payload_json,
        raw_model_output_json: normalized.raw,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ normalized_profile_id: data.id, ...normalized.parsed }, { status: 200 });
  } catch (error) {
    console.error("normalize-profile failed", { stage, error });
    captureServerError(error, { route: "ai/normalize-profile", stage });
    const details = getErrorDetails(error);
    const status = error instanceof z.ZodError && stage === "parse-request" ? 400 : 500;
    return NextResponse.json(
      {
        error: status === 400 ? "Invalid request payload" : "Failed to normalize profile",
        stage,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status },
    );
  }
}
