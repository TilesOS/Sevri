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
import { getRouteGenerationMetadata, getWeeklyHoursForStorage, runOptionsGeneration, runProfileNormalization } from "@/lib/ai/pipelines";
import { getGenerationFailureMessage, getGenerationFailureStatus } from "@/lib/ai/client";
import { withProfileIdentity } from "@/lib/ai/intake-identity";
import { getProfileIdentity } from "@/lib/db/queries/profile";
import { getRecommendationGenerationCount, getLatestProjectTrack } from "@/lib/db/queries/recommendations";
import { getRecommendationFeedback } from "@/lib/db/queries/generation-feedback";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getGenerationLimit } from "@/lib/usage/limits";
import { reserveRecommendationGeneration } from "@/lib/usage/recommendation-quota";
import { trackEvent } from "@/lib/analytics/track";
import { captureServerError } from "@/lib/sentry/server";
import { asSentence } from "@/lib/text/prose";
import { toStudentVoice } from "@/lib/text/student-voice";

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

export async function POST(request: Request) {
  const routeStartedAt = performance.now();
  let stage = "start";
  let rateLimitReservationId: string | null = null;
  let entitlementReservationId: string | null = null;

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
      endpoint: "recommendations",
      maxRequests: 12,
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

    stage = "load-plan-and-track";
    const [plan, defaultTrack] = await Promise.all([
      getUserPlan(user.id),
      getLatestProjectTrack(user.id),
    ]);
    const generationLimit = getGenerationLimit(plan);
    let generationsUsedAfterSuccess: number;

    if (generationLimit === null) {
      const generatedCount = await getRecommendationGenerationCount(user.id);
      generationsUsedAfterSuccess = generatedCount + 1;
    } else {
      stage = "reserve-generation-entitlement";
      const entitlement = await reserveRecommendationGeneration(user.id, generationLimit);

      if (!entitlement.allowed) {
        const temporarilyReserved = entitlement.resetAt !== null;
        return NextResponse.json(
          {
            code: temporarilyReserved ? "generation_in_progress" : "generation_limit_reached",
            error: temporarilyReserved
              ? "Another idea board is already being generated. Wait for it to finish, then try again."
              : `You've used your ${generationLimit} free idea boards. You've explored multiple directions. Upgrade to keep refining.`,
            generations_used: entitlement.generationsUsed,
            generation_limit: generationLimit,
            reset_at: entitlement.resetAt,
          },
          {
            status: temporarilyReserved ? 429 : 403,
            headers: temporarilyReserved
              ? { "Retry-After": String(entitlement.retryAfterSeconds) }
              : undefined,
          },
        );
      }

      entitlementReservationId = entitlement.reservationId;
      generationsUsedAfterSuccess = entitlement.generationsUsed;
    }

    const activeTrack = body.project_track ?? defaultTrack;

    stage = "create-supabase-client";
    const supabase = await createServerSupabaseClient();

    stage = "fetch-intake";
    const { data: intake, error: intakeError } = await supabase
      .from("intakes")
      .select("id, raw_answers_json, project_track")
      .eq("user_id", user.id)
      .eq("project_track", activeTrack)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (intakeError || !intake) {
      return NextResponse.json({ error: `Complete ${activeTrack} onboarding first` }, { status: 400 });
    }

    stage = "load-feedback";
    const feedback = await getRecommendationFeedback(user.id, activeTrack);

    stage = "resolve-profile-identity";
    // Stage comes from the profile, not from this track's saved intake, so both
    // tracks describe the same student.
    const identity = await getProfileIdentity(user.id).catch(() => ({ studentStage: null }));

    stage = "normalize-context";
    const normalized = await runProfileNormalization({
      projectTrack: intake.project_track === "research" ? "research" : "software",
      rawIntake: withProfileIdentity((intake.raw_answers_json as Record<string, unknown>) ?? {}, identity),
      feedback,
    });
    const context = normalized.parsed;

    stage = "store-context-snapshot";
    const { data: contextSnapshot, error: snapshotError } = await supabase
      .from("normalized_profiles")
      .insert({
        user_id: user.id,
        intake_id: intake.id,
        project_track: context.project_track,
        summary: context.summary,
        interpreted_interests: context.interpreted_interests,
        skill_assessment: context.skill_assessment,
        risk_flags: context.risk_flags,
        track_payload_json: context.track_payload_json,
        raw_model_output_json: {
          context,
          response: normalized.raw,
          citations: normalized.citations,
          refusal: normalized.refusal,
          metrics: normalized.metrics,
        },
      })
      .select("id")
      .single();

    if (snapshotError) {
      throw new Error(snapshotError.message);
    }

    stage = "generate-options";
    const generated = await runOptionsGeneration(context, feedback);
    const weeklyHours = getWeeklyHoursForStorage(context);

    const payload = generated.parsed.recommendations.map((recommendation) => ({
      user_id: user.id,
      intake_id: intake.id,
      normalized_profile_id: contextSnapshot.id,
      project_track: recommendation.project_track,
      title: recommendation.title,
      summary: recommendation.summary,
      rationale: recommendation.why_it_fits,
      difficulty: recommendation.difficulty,
      estimated_weeks: recommendation.estimated_weeks,
      weekly_hours: weeklyHours,
      skills_demonstrated: recommendation.skills_demonstrated,
      tools_needed: recommendation.tools_needed,
      impressiveness_score: recommendation.impressiveness_score,
      finishability_score: recommendation.finishability_score,
      // Shown on the idea board, so it is stored addressed to the student rather
      // than as the pipeline-facing third-person summary.
      authenticity_note: asSentence(toStudentVoice(context.summary)),
      track_payload_json: recommendation.track_payload_json,
      raw_model_output_json: {
        recommendation,
        response: generated.raw,
        metrics: generated.metrics,
      },
    }));

    stage = "insert-recommendations";
    const { data: insertedRecommendations, error: insertError } = await supabase
      .from("project_recommendations")
      .insert(payload)
      .select("*");

    if (insertError) {
      throw new Error(insertError.message);
    }

    stage = "consume-reservations";
    const completedEntitlementReservationId = entitlementReservationId;
    const completedRateLimitReservationId = rateLimitReservationId;
    entitlementReservationId = null;
    rateLimitReservationId = null;
    await Promise.all([
      ...(completedEntitlementReservationId
        ? [
            consumeRateLimitReservation(
              completedEntitlementReservationId,
              contextSnapshot.id,
            ),
          ]
        : []),
      consumeRateLimitReservation(completedRateLimitReservationId),
    ]);

    const routeMetadata = getRouteGenerationMetadata({
      metrics: generated.metrics,
      routeTotalMs: performance.now() - routeStartedAt,
      cacheHit: false,
    });

    stage = "track-options-generated";
    void trackEvent(user.id, "recommendations_generated", {
      count: insertedRecommendations?.length ?? 0,
      normalized_profile_id: contextSnapshot.id,
      project_track: activeTrack,
      ...routeMetadata,
    }).catch((trackError) => {
      console.error("recommendations track failed", { stage, error: trackError });
      captureServerError(trackError, {
        route: "ai/recommendations",
        stage: "track-options-generated",
      });
    });

    return NextResponse.json(
      {
        project_track: activeTrack,
        normalized_profile_id: contextSnapshot.id,
        generations_used: generationsUsedAfterSuccess,
        generation_limit: generationLimit,
        recommendations: (insertedRecommendations ?? []).map((recommendation) => ({
          id: recommendation.id,
          normalized_profile_id: recommendation.normalized_profile_id,
          project_track: recommendation.project_track === "research" ? "research" : "software",
          title: recommendation.title,
          summary: recommendation.summary,
          why_it_fits: recommendation.rationale,
          difficulty: recommendation.difficulty,
          estimated_weeks: recommendation.estimated_weeks,
          weekly_hours: recommendation.weekly_hours,
          skills_demonstrated: recommendation.skills_demonstrated,
          tools_needed: recommendation.tools_needed,
          impressiveness_score: recommendation.impressiveness_score,
          finishability_score: recommendation.finishability_score,
          authenticity_note: recommendation.authenticity_note,
          track_payload_json: recommendation.track_payload_json,
        })),
        timings: routeMetadata,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("recommendations failed", { stage, error });
    captureServerError(error, { route: "ai/recommendations", stage });
    const details = getErrorDetails(error);
    const status =
      error instanceof RateLimitUnavailableError
        ? 503
        : error instanceof z.ZodError && stage === "parse-request"
        ? 400
        : stage === "normalize-context" || stage === "generate-options"
          ? getGenerationFailureStatus(error)
          : 500;
    return NextResponse.json(
      {
        error:
          status === 503
            ? "Idea generation is temporarily unavailable. Try again in a moment."
            : status === 400
            ? "Invalid request payload"
            : stage === "normalize-context" || stage === "generate-options"
              ? getGenerationFailureMessage(error, "Failed to generate recommendations")
              : "Failed to generate recommendations",
        stage,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status },
    );
  } finally {
    const reservations = [entitlementReservationId, rateLimitReservationId].filter(
      (value): value is string => Boolean(value),
    );
    await Promise.all(
      reservations.map((reservationId) =>
        releaseRateLimitReservation(reservationId).catch((releaseError) => {
          captureServerError(releaseError, {
            route: "ai/recommendations",
            stage: "release-reservation",
          });
        }),
      ),
    );
  }
}
