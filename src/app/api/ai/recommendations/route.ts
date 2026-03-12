import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { runRecommendationGeneration } from "@/lib/ai/pipelines";
import { getRecommendationGenerationCount, getLatestProjectTrack } from "@/lib/db/queries/recommendations";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { canGenerateRecommendations } from "@/lib/usage/limits";
import { trackEvent } from "@/lib/analytics/events";
import { captureServerError } from "@/lib/sentry/server";
import { coerceStoredNormalizedProfile } from "@/lib/ai/normalized-profile";

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
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));

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
      captureServerError(rateLimitError, {
        route: "ai/recommendations",
        stage: "rate-limit",
      });
    }

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
    const supabase = await createServerSupabaseClient();

    const { data: normalizedProfiles, error: profileError } = await supabase
      .from("normalized_profiles")
      .select("id, intake_id, summary, interpreted_interests, skill_assessment, risk_flags, project_track, track_payload_json")
      .eq("user_id", user.id)
      .eq("project_track", activeTrack)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profileError || !normalizedProfiles) {
      return NextResponse.json({ error: `Generate a ${activeTrack} normalized profile first` }, { status: 400 });
    }

    const generated = await runRecommendationGeneration(
      coerceStoredNormalizedProfile({
        summary: normalizedProfiles.summary,
        interpreted_interests: normalizedProfiles.interpreted_interests,
        skill_assessment: normalizedProfiles.skill_assessment,
        risk_flags: normalizedProfiles.risk_flags,
        project_track: normalizedProfiles.project_track,
        track_payload_json: normalizedProfiles.track_payload_json,
      }),
    );

    const payload = generated.parsed.recommendations.map((recommendation) => ({
      user_id: user.id,
      intake_id: normalizedProfiles.intake_id,
      normalized_profile_id: normalizedProfiles.id,
      project_track: recommendation.project_track,
      title: recommendation.title,
      summary: recommendation.summary,
      rationale: recommendation.rationale,
      difficulty: recommendation.difficulty,
      estimated_weeks: recommendation.estimated_weeks,
      weekly_hours: recommendation.weekly_hours,
      skills_demonstrated: recommendation.skills_demonstrated,
      tools_needed: recommendation.tools_needed,
      impressiveness_score: recommendation.impressiveness_score,
      finishability_score: recommendation.finishability_score,
      authenticity_note: recommendation.authenticity_note,
      track_payload_json: recommendation.track_payload_json,
      raw_model_output_json: recommendation,
    }));

    const { data: insertedRecommendations, error: insertError } = await supabase
      .from("project_recommendations")
      .insert(payload)
      .select("*");

    if (insertError) {
      throw new Error(insertError.message);
    }

    const recommendations = insertedRecommendations ?? [];

    try {
      await trackEvent(user.id, "recommendations_generated", {
        count: recommendations.length,
        normalized_profile_id: normalizedProfiles.id,
        project_track: activeTrack,
      });
    } catch (trackError) {
      captureServerError(trackError, {
        route: "ai/recommendations",
        stage: "post-generate-track",
      });
    }

    return NextResponse.json({ recommendations, project_track: activeTrack }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "ai/recommendations" });
    const details = getErrorDetails(error);
    return NextResponse.json(
      {
        error: "Failed to generate recommendations",
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status: 500 },
    );
  }
}
