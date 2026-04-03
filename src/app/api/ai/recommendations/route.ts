import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { getRouteGenerationMetadata, getWeeklyHoursForStorage, runOptionsGeneration, runProfileNormalization } from "@/lib/ai/pipelines";
import { getRecommendationGenerationCount, getLatestProjectTrack } from "@/lib/db/queries/recommendations";
import { getRecommendationFeedback } from "@/lib/db/queries/generation-feedback";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { canGenerateRecommendations } from "@/lib/usage/limits";
import { trackEvent } from "@/lib/analytics/track";
import { captureServerError } from "@/lib/sentry/server";

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
        endpoint: "recommendations",
        maxRequests: 12,
        windowMinutes: 60,
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded", reset_at: rateLimit.resetAt },
          { status: 429 },
        );
      }
    } catch (rateLimitError) {
      console.error("recommendations rate-limit failed", { stage, error: rateLimitError });
      captureServerError(rateLimitError, {
        route: "ai/recommendations",
        stage: "rate-limit",
      });
    }

    stage = "load-plan-and-track";
    const [plan, generatedCount, defaultTrack] = await Promise.all([
      getUserPlan(user.id),
      getRecommendationGenerationCount(user.id),
      getLatestProjectTrack(user.id),
    ]);

    if (!canGenerateRecommendations(plan, generatedCount)) {
      return NextResponse.json(
        { error: "Free tier limit reached. Upgrade to Pro for more recommendation refreshes." },
        { status: 403 },
      );
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

    stage = "normalize-context";
    const normalized = await runProfileNormalization({
      projectTrack: intake.project_track === "research" ? "research" : "software",
      rawIntake: (intake.raw_answers_json as Record<string, unknown>) ?? {},
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
      authenticity_note: context.summary,
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
    const status = error instanceof z.ZodError && stage === "parse-request" ? 400 : 500;
    return NextResponse.json(
      {
        error: status === 400 ? "Invalid request payload" : "Failed to generate recommendations",
        stage,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status },
    );
  }
}
