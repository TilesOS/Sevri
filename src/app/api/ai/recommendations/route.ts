import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { runRecommendationGeneration } from "@/lib/ai/pipelines";
import { getRecommendationGenerationCount } from "@/lib/db/queries/recommendations";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { canGenerateRecommendations } from "@/lib/usage/limits";
import { trackEvent } from "@/lib/analytics/events";
import { captureServerError } from "@/lib/sentry/server";

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

export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
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

    const [plan, generatedCount] = await Promise.all([
      getUserPlan(user.id),
      getRecommendationGenerationCount(user.id),
    ]);

    if (!canGenerateRecommendations(plan, generatedCount)) {
      return NextResponse.json(
        { error: "Free tier limit reached. Upgrade to Pro for more recommendation refreshes." },
        { status: 403 },
      );
    }

    const supabase = await createServerSupabaseClient();

    const { data: normalizedProfile, error: profileError } = await supabase
      .from("normalized_profiles")
      .select("id, intake_id, summary, interpreted_interests, skill_assessment, risk_flags")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profileError || !normalizedProfile) {
      return NextResponse.json({ error: "Generate a normalized profile first" }, { status: 400 });
    }

    const generated = await runRecommendationGeneration({
      summary: normalizedProfile.summary,
      interpreted_interests: normalizedProfile.interpreted_interests,
      skill_assessment: normalizedProfile.skill_assessment as "beginner" | "intermediate" | "advanced",
      risk_flags: normalizedProfile.risk_flags as Array<
        "too_ambitious" | "too_vague" | "too_advanced" | "too_little_time" | "misaligned_goal"
      >,
    });

    const payload = generated.parsed.recommendations.map((recommendation) => ({
      user_id: user.id,
      intake_id: normalizedProfile.intake_id,
      normalized_profile_id: normalizedProfile.id,
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
        normalized_profile_id: normalizedProfile.id,
      });
    } catch (trackError) {
      captureServerError(trackError, {
        route: "ai/recommendations",
        stage: "post-generate-track",
      });
    }

    return NextResponse.json({ recommendations }, { status: 200 });
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
