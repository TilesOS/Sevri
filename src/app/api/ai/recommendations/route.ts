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
import type { NormalizedProfile } from "@/lib/ai/schemas";

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

function asProjectTrack(value: unknown): "software" | "research" {
  return value === "research" ? "research" : "software";
}

function asRiskFlags(value: unknown): Array<
  | "too_ambitious"
  | "too_vague"
  | "too_advanced"
  | "too_little_time"
  | "misaligned_goal"
  | "insufficient_guidance"
  | "resource_constraint"
> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is
      | "too_ambitious"
      | "too_vague"
      | "too_advanced"
      | "too_little_time"
      | "misaligned_goal"
      | "insufficient_guidance"
      | "resource_constraint" =>
      typeof item === "string" &&
      [
        "too_ambitious",
        "too_vague",
        "too_advanced",
        "too_little_time",
        "misaligned_goal",
        "insufficient_guidance",
        "resource_constraint",
      ].includes(item),
  );
}

function asNormalizedProfile(value: {
  summary: string;
  interpreted_interests: string[];
  skill_assessment: string;
  risk_flags: string[];
  project_track: string;
  track_payload_json: unknown;
}): NormalizedProfile {
  const projectTrack = asProjectTrack(value.project_track);

  if (projectTrack === "research") {
    const researchPayload = value.track_payload_json as Record<string, unknown> | null;

    return {
      project_track: "research",
      summary: value.summary,
      interpreted_interests: value.interpreted_interests,
      skill_assessment: value.skill_assessment as "beginner" | "intermediate" | "advanced",
      risk_flags: asRiskFlags(value.risk_flags),
      track_payload_json: {
        research_readiness:
          typeof researchPayload?.research_readiness === "string"
            ? researchPayload.research_readiness
            : "Student should keep method scope narrow and practical.",
        scope_guardrails:
          Array.isArray(researchPayload?.scope_guardrails) && researchPayload.scope_guardrails.length >= 2
            ? (researchPayload.scope_guardrails as string[])
            : ["One question", "One primary method"],
        mentor_resource_notes:
          typeof researchPayload?.mentor_resource_notes === "string"
            ? researchPayload.mentor_resource_notes
            : "Use accessible resources and mentor checkpoints where possible.",
      },
    };
  }

  const softwarePayload = value.track_payload_json as Record<string, unknown> | null;

  return {
    project_track: "software",
    summary: value.summary,
    interpreted_interests: value.interpreted_interests,
    skill_assessment: value.skill_assessment as "beginner" | "intermediate" | "advanced",
    risk_flags: asRiskFlags(value.risk_flags),
    track_payload_json: {
      project_style_fit:
        typeof softwarePayload?.project_style_fit === "string"
          ? softwarePayload.project_style_fit
          : "Focus on one strong software workflow with clear portfolio impact.",
      scope_guardrails:
        Array.isArray(softwarePayload?.scope_guardrails) && softwarePayload.scope_guardrails.length >= 2
          ? (softwarePayload.scope_guardrails as string[])
          : ["Keep MVP narrow", "Cut advanced features if timeline slips"],
    },
  };
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

    const { data: latestIntake } = await supabase
      .from("intakes")
      .select("project_track")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const activeTrack = asProjectTrack(latestIntake?.project_track);

    const { data: normalizedProfiles, error: profileError } = await supabase
      .from("normalized_profiles")
      .select("id, intake_id, summary, interpreted_interests, skill_assessment, risk_flags, project_track, track_payload_json")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (profileError || !normalizedProfiles?.length) {
      return NextResponse.json({ error: "Generate a normalized profile first" }, { status: 400 });
    }

    const normalizedProfileRow = normalizedProfiles.find((row) => asProjectTrack(row.project_track) === activeTrack);

    if (!normalizedProfileRow) {
      return NextResponse.json({ error: "Generate a normalized profile first" }, { status: 400 });
    }

    const generated = await runRecommendationGeneration(
      asNormalizedProfile({
        summary: normalizedProfileRow.summary,
        interpreted_interests: normalizedProfileRow.interpreted_interests,
        skill_assessment: normalizedProfileRow.skill_assessment,
        risk_flags: normalizedProfileRow.risk_flags,
        project_track: normalizedProfileRow.project_track,
        track_payload_json: normalizedProfileRow.track_payload_json,
      }),
    );

    const payload = generated.parsed.recommendations.map((recommendation) => ({
      user_id: user.id,
      intake_id: normalizedProfileRow.intake_id,
      normalized_profile_id: normalizedProfileRow.id,
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
        normalized_profile_id: normalizedProfileRow.id,
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

