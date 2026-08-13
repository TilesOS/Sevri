import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  consumeRateLimitReservation,
  enforceRateLimit,
  RateLimitUnavailableError,
  releaseRateLimitReservation,
} from "@/lib/usage/rate-limit";
import { RATE_LIMITED_MESSAGE } from "@/lib/errors/user-messages";
import { buildGenerationContext } from "@/lib/ai/generation-context";
import { withProfileIdentity } from "@/lib/ai/intake-identity";
import { captureServerError } from "@/lib/sentry/server";
import { getProfileIdentity } from "@/lib/db/queries/profile";
import { getGenerationVersion } from "@/lib/ai/client";

export const runtime = "nodejs";

const bodySchema = z.object({});

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

export async function POST(request: Request) {
  let stage = "start";
  let rateLimitReservationId: string | null = null;
  try {
    stage = "auth";
    const { user, response } = await requireApiUser();
    if (!user) {
      return response;
    }

    stage = "parse-request";
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    stage = "rate-limit";
    const rateLimit = await enforceRateLimit({
      userId: user.id,
      endpoint: "normalize-profile",
      maxRequests: 10,
      windowMinutes: 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: RATE_LIMITED_MESSAGE, code: "rate_limited", reset_at: rateLimit.resetAt },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }
    rateLimitReservationId = rateLimit.reservationId;

    stage = "create-supabase-client";
    const supabase = await createServerSupabaseClient();

    void body;

    stage = "fetch-intake";
    const { data: intake, error: intakeError } = await supabase
      .from("intakes")
      .select("id, raw_answers_json")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intakeError || !intake) {
      return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
    }

    stage = "resolve-profile-identity";
    // Stage comes from the profile rather than stale intake history.
    const identity = await getProfileIdentity(user.id).catch(() => ({ studentStage: null }));

    stage = "build-context";
    const normalized = buildGenerationContext({
      rawIntake: withProfileIdentity((intake.raw_answers_json as Record<string, unknown>) ?? {}, identity),
    });

    stage = "insert-context";
    const { data, error } = await supabase
      .from("normalized_profiles")
      .insert({
        user_id: user.id,
        intake_id: intake.id,
        summary: normalized.summary,
        interpreted_interests: normalized.interpreted_interests,
        skill_assessment: normalized.skill_assessment,
        risk_flags: normalized.risk_flags,
        project_context_json: normalized.project_context_json,
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

    stage = "consume-rate-limit";
    const completedReservationId = rateLimitReservationId;
    rateLimitReservationId = null;
    await consumeRateLimitReservation(completedReservationId);

    return NextResponse.json({ normalized_profile_id: data.id, ...normalized }, { status: 200 });
  } catch (error) {
    console.error("normalize-profile failed", { stage, error });
    captureServerError(error, { route: "ai/normalize-profile", stage });
    const details = getErrorDetails(error);
    const status =
      error instanceof RateLimitUnavailableError
        ? 503
        : error instanceof z.ZodError && stage === "parse-request"
          ? 400
          : 500;
    return NextResponse.json(
      {
        error:
          status === 503
            ? "Profile preparation is temporarily unavailable. Try again in a moment."
            : status === 400
              ? "Invalid request payload"
              : "Failed to build generation context",
        stage,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status },
    );
  } finally {
    if (rateLimitReservationId) {
      await releaseRateLimitReservation(rateLimitReservationId).catch((releaseError) => {
        captureServerError(releaseError, {
          route: "ai/normalize-profile",
          stage: "release-rate-limit",
        });
      });
    }
  }
}
