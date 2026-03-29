import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runStepGuidanceGeneration, getRouteGenerationMetadata } from "@/lib/ai/pipelines";
import { coerceStoredNormalizedProfile } from "@/lib/ai/normalized-profile";
import { buildRoadmapOverviewFromStorage, coerceStoredProjectOption } from "@/lib/ai/storage";
import { StepGuidanceSchema } from "@/lib/ai/schemas";
import { getGenerationVersion } from "@/lib/ai/client";
import { trackEvent } from "@/lib/analytics/events";
import { captureServerError } from "@/lib/sentry/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  refresh: z.boolean().optional(),
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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
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
    const { id } = await context.params;

    stage = "create-supabase-client";
    const supabase = await createServerSupabaseClient();

    stage = "fetch-milestone";
    const { data: milestone, error: milestoneError } = await supabase
      .from("milestones")
      .select("*")
      .eq("id", id)
      .single();

    if (milestoneError || !milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    stage = "fetch-project";
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, title, recommendation_id, project_track")
      .eq("id", milestone.project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!body.refresh) {
      stage = "check-cache";
      const { data: cachedGuidance } = await supabase
        .from("milestone_guidance")
        .select("guidance_json, generation_version")
        .eq("milestone_id", milestone.id)
        .maybeSingle();

      if (cachedGuidance) {
        try {
          const parsed = StepGuidanceSchema.parse(cachedGuidance.guidance_json);
          return NextResponse.json(
            {
              guidance: parsed,
              cache_hit: true,
              timings: {
                stage: "step_guidance",
                generation_version: cachedGuidance.generation_version ?? getGenerationVersion(),
                model: "cache",
                attempt_count: 0,
                fallback_used: false,
                cache_hit: true,
                route_total_ms: Math.round(performance.now() - routeStartedAt),
                ai_total_ms: 0,
                validation_ms: 0,
                prompt_chars: 0,
                output_chars: JSON.stringify(parsed).length,
              },
            },
            { status: 200 },
          );
        } catch {
          // Ignore malformed cache and regenerate.
        }
      }
    }

    stage = "fetch-roadmap";
    const { data: roadmap, error: roadmapError } = await supabase
      .from("project_roadmaps")
      .select("overview, track_payload_json")
      .eq("project_id", project.id)
      .single();

    if (roadmapError || !roadmap) {
      return NextResponse.json({ error: "Generate the roadmap first" }, { status: 400 });
    }

    stage = "fetch-project-milestones";
    const { data: milestones, error: milestonesError } = await supabase
      .from("milestones")
      .select("*")
      .eq("project_id", project.id)
      .order("order_index", { ascending: true });

    if (milestonesError) {
      throw new Error(milestonesError.message);
    }

    stage = "fetch-recommendation";
    const { data: recommendation, error: recommendationError } = await supabase
      .from("project_recommendations")
      .select("*")
      .eq("id", project.recommendation_id)
      .eq("user_id", user.id)
      .single();

    if (recommendationError || !recommendation) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 400 });
    }

    stage = "fetch-context";
    const { data: contextRow, error: contextError } = await supabase
      .from("normalized_profiles")
      .select("summary, interpreted_interests, skill_assessment, risk_flags, project_track, track_payload_json")
      .eq("id", recommendation.normalized_profile_id)
      .eq("user_id", user.id)
      .single();

    if (contextError || !contextRow) {
      return NextResponse.json({ error: "Generation context not found" }, { status: 400 });
    }

    const generationContext = coerceStoredNormalizedProfile({
      summary: contextRow.summary,
      interpreted_interests: contextRow.interpreted_interests,
      skill_assessment: contextRow.skill_assessment,
      risk_flags: contextRow.risk_flags,
      project_track: contextRow.project_track,
      track_payload_json: contextRow.track_payload_json,
    });

    const selectedOption = coerceStoredProjectOption({
      id: recommendation.id,
      project_track: recommendation.project_track,
      title: recommendation.title,
      summary: recommendation.summary,
      rationale: recommendation.rationale,
      difficulty: recommendation.difficulty,
      estimated_weeks: recommendation.estimated_weeks,
      track_payload_json: recommendation.track_payload_json,
    });

    const roadmapOverview = buildRoadmapOverviewFromStorage({
      projectTitle: project.title,
      roadmapOverview: roadmap.overview,
      trackPayloadJson: roadmap.track_payload_json,
      milestones: milestones ?? [],
    });

    const currentStep = roadmapOverview.steps.find((step) => step.order_index === milestone.order_index);
    if (!currentStep) {
      return NextResponse.json({ error: "Roadmap step not found" }, { status: 404 });
    }

    const previousStep = roadmapOverview.steps.find((step) => step.order_index === milestone.order_index - 1);
    const nextStep = roadmapOverview.steps.find((step) => step.order_index === milestone.order_index + 1);

    stage = "generate-guidance";
    const generated = await runStepGuidanceGeneration({
      context: generationContext,
      selectedOption,
      roadmap: roadmapOverview,
      step: currentStep,
      previousStep,
      nextStep,
    });

    stage = "store-guidance";
    const { error: upsertError } = await supabase.from("milestone_guidance").upsert(
      {
        milestone_id: milestone.id,
        guidance_json: generated.parsed,
        email_payload_json: generated.parsed.email_version,
        raw_model_output_json: {
          guidance: generated.raw,
          metrics: generated.metrics,
        },
        generation_version: generated.metrics.generation_version,
      },
      { onConflict: "milestone_id" },
    );

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    const routeMetadata = getRouteGenerationMetadata({
      metrics: generated.metrics,
      routeTotalMs: performance.now() - routeStartedAt,
      cacheHit: false,
    });

    stage = "track-guidance";
    void trackEvent(user.id, "milestone_guidance_generated", {
      project_id: project.id,
      milestone_id: milestone.id,
      project_track: project.project_track === "research" ? "research" : "software",
      ...routeMetadata,
    }).catch((trackError) => {
      console.error("milestone guidance track failed", { stage, error: trackError });
      captureServerError(trackError, {
        route: "ai/milestones/guidance",
        stage: "track-guidance",
      });
    });

    return NextResponse.json(
      {
        guidance: generated.parsed,
        cache_hit: false,
        timings: routeMetadata,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("milestone guidance failed", { stage, error });
    captureServerError(error, { route: "ai/milestones/guidance", stage });
    const details = getErrorDetails(error);
    const status = error instanceof z.ZodError && stage === "parse-request" ? 400 : 500;

    return NextResponse.json(
      {
        error: status === 400 ? "Invalid request payload" : "Failed to generate step guidance",
        stage,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status },
    );
  }
}
