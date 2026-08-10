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
import { assertFeatureAccess, createUpgradeRequiredResponse } from "@/lib/usage/feature-access";
import { runStepGuidanceGeneration, getRouteGenerationMetadata } from "@/lib/ai/pipelines";
import { coerceStoredNormalizedProfile } from "@/lib/ai/normalized-profile";
import { buildRoadmapOverviewFromStorage, coerceStoredProjectOption } from "@/lib/ai/storage";
import { getStepGuidanceFeedback } from "@/lib/db/queries/generation-feedback";
import { getStepGuidanceGate } from "@/lib/projects/step-guidance-lock";
import { StepGuidanceSchema } from "@/lib/ai/schemas";
import {
  getGenerationFailureMessage,
  getGenerationFailureStatus,
  getGenerationVersion,
  type GenerationCitation,
  type GenerationMetrics,
} from "@/lib/ai/client";
import { trackEvent } from "@/lib/analytics/track";
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

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function getStoredCitations(rawModelOutput: unknown): GenerationCitation[] {
  const raw = asRecord(rawModelOutput);
  if (!raw || !Array.isArray(raw.citations)) {
    return [];
  }

  const citations: GenerationCitation[] = [];

  for (const citation of raw.citations) {
    const item = asRecord(citation);
    if (!item || typeof item.url !== "string" || item.url.trim().length === 0) {
      continue;
    }

    citations.push({
      title: typeof item.title === "string" ? item.title : undefined,
      url: item.url,
      start_index: typeof item.start_index === "number" ? item.start_index : undefined,
      end_index: typeof item.end_index === "number" ? item.end_index : undefined,
    });
  }

  return citations;
}

function getStoredMetrics(rawModelOutput: unknown) {
  const raw = asRecord(rawModelOutput);
  const metrics = raw ? asRecord(raw.metrics) : null;
  return metrics as Partial<GenerationMetrics> | null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const routeStartedAt = performance.now();
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
    const { id } = await context.params;

    stage = "feature-access";
    const featureAccess = await assertFeatureAccess({
      userId: user.id,
      feature: "step_guidance",
    });

    if (!featureAccess.allowed) {
      return createUpgradeRequiredResponse(featureAccess.error);
    }

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
      .select("id, title, recommendation_id, project_kind_label")
      .eq("id", milestone.project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
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

    const guidanceGate = getStepGuidanceGate(milestones ?? [], milestone.order_index);
    if (guidanceGate.guidanceLocked) {
      return NextResponse.json(
        {
          error: `Finish Step ${guidanceGate.previousStepNumber} before opening guidance for this step.`,
          code: "previous_step_incomplete",
          previous_step_number: guidanceGate.previousStepNumber,
        },
        { status: 423 },
      );
    }

    // Reading stored guidance is free. The cache is read on every request —
    // including a refresh — so that a rate-limited refresh can still hand back
    // the coaching the student already has instead of an empty workbench.
    stage = "check-cache";
    const { data: cachedGuidance } = await supabase
      .from("milestone_guidance")
      .select("id, guidance_json, generation_version, raw_model_output_json, checklist_state_json")
      .eq("milestone_id", milestone.id)
      .maybeSingle();

    const buildCachedPayload = (rateLimited: boolean) => {
      if (!cachedGuidance) {
        return null;
      }

      try {
        const parsed = StepGuidanceSchema.parse(cachedGuidance.guidance_json);
        const cachedCitations = getStoredCitations(cachedGuidance.raw_model_output_json);
        const cachedMetrics = getStoredMetrics(cachedGuidance.raw_model_output_json);
        const cachedChecklistState =
          cachedGuidance.checklist_state_json &&
          typeof cachedGuidance.checklist_state_json === "object" &&
          !Array.isArray(cachedGuidance.checklist_state_json)
            ? (cachedGuidance.checklist_state_json as Record<string, boolean>)
            : {};

        return {
          milestone_guidance_id: cachedGuidance.id,
          guidance: parsed,
          checklist_state: cachedChecklistState,
          cache_hit: true,
          // Set only when a refresh was throttled: the stored coaching below is
          // real, it just isn't newly generated.
          ...(rateLimited ? { rate_limited: true, notice: RATE_LIMITED_MESSAGE } : {}),
          timings: {
            stage: cachedMetrics?.stage ?? "step_guidance",
            generation_version:
              cachedGuidance.generation_version ?? cachedMetrics?.generation_version ?? getGenerationVersion(),
            model: cachedMetrics?.model ?? "cache",
            attempt_count: typeof cachedMetrics?.attempt_count === "number" ? cachedMetrics.attempt_count : 0,
            fallback_used: cachedMetrics?.fallback_used ?? false,
            cache_hit: true,
            route_total_ms: Math.round(performance.now() - routeStartedAt),
            ai_total_ms: typeof cachedMetrics?.ai_total_ms === "number" ? cachedMetrics.ai_total_ms : 0,
            validation_ms: typeof cachedMetrics?.validation_ms === "number" ? cachedMetrics.validation_ms : 0,
            prompt_chars: typeof cachedMetrics?.prompt_chars === "number" ? cachedMetrics.prompt_chars : 0,
            output_chars: JSON.stringify(parsed).length,
            fallback_model_used:
              typeof cachedMetrics?.fallback_model_used === "string" ? cachedMetrics.fallback_model_used : null,
            validator_failed: cachedMetrics?.validator_failed ?? false,
            validator_issue_count:
              typeof cachedMetrics?.validator_issue_count === "number" ? cachedMetrics.validator_issue_count : 0,
            tool_used: cachedMetrics?.tool_used ?? cachedCitations.length > 0,
            web_search_used: cachedMetrics?.web_search_used ?? cachedCitations.length > 0,
            citation_count: cachedCitations.length,
            refusal_detected: cachedMetrics?.refusal_detected ?? false,
          },
          ...(cachedCitations.length > 0 ? { citations: cachedCitations } : {}),
        };
      } catch {
        // Malformed cache is treated as absent, so the step regenerates.
        return null;
      }
    };

    if (!body.refresh) {
      const cachedPayload = buildCachedPayload(false);
      if (cachedPayload) {
        return NextResponse.json(cachedPayload, { status: 200 });
      }
    }

    // Only generation is rate limited. Retrieval above never consumes budget, so
    // normal step-to-step navigation cannot trip this.
    stage = "rate-limit";
    const rateLimit = await enforceRateLimit({
      userId: user.id,
      endpoint: "milestone-guidance",
      maxRequests: 8,
      windowMinutes: 60,
    });

    if (!rateLimit.allowed) {
      const cachedPayload = buildCachedPayload(true);
      if (cachedPayload) {
        return NextResponse.json(cachedPayload, {
          status: 200,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        });
      }

      return NextResponse.json(
        { error: RATE_LIMITED_MESSAGE, code: "rate_limited", reset_at: rateLimit.resetAt },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        },
      );
    }
    rateLimitReservationId = rateLimit.reservationId;

    stage = "fetch-roadmap";
    const { data: roadmap, error: roadmapError } = await supabase
      .from("project_roadmaps")
      .select("overview, roadmap_context_json, core_scope, artifact_plan, project_overview_draft")
      .eq("project_id", project.id)
      .single();

    if (roadmapError || !roadmap) {
      return NextResponse.json({ error: "Generate the roadmap first" }, { status: 400 });
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
      .select("summary, interpreted_interests, skill_assessment, risk_flags, project_context_json")
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
      project_context_json: contextRow.project_context_json,
    });

    const selectedOption = coerceStoredProjectOption({
      id: recommendation.id,
      title: recommendation.title,
      summary: recommendation.summary,
      rationale: recommendation.rationale,
      difficulty: recommendation.difficulty,
      estimated_weeks: recommendation.estimated_weeks,
      project_kind_label: recommendation.project_kind_label,
      repository_relevance: recommendation.repository_relevance,
      skills_demonstrated: recommendation.skills_demonstrated,
      tools_needed: recommendation.tools_needed,
      impressiveness_score: recommendation.impressiveness_score,
      finishability_score: recommendation.finishability_score,
      project_blueprint_json: recommendation.project_blueprint_json,
      grounding_sources_json: recommendation.grounding_sources_json,
    });

    const roadmapOverview = buildRoadmapOverviewFromStorage({
      projectTitle: project.title,
      roadmapOverview: roadmap.overview,
      roadmapContextJson: roadmap.roadmap_context_json,
      coreScope: roadmap.core_scope,
      artifactPlan: roadmap.artifact_plan,
      projectOverviewDraft: roadmap.project_overview_draft,
      milestones: milestones ?? [],
    });

    const currentStep = roadmapOverview.steps.find((step) => step.order_index === milestone.order_index);
    if (!currentStep) {
      return NextResponse.json({ error: "Roadmap step not found" }, { status: 404 });
    }

    const previousStep = roadmapOverview.steps.find((step) => step.order_index === milestone.order_index - 1);
    const nextStep = roadmapOverview.steps.find((step) => step.order_index === milestone.order_index + 1);

    stage = "load-feedback";
    const feedback = await getStepGuidanceFeedback({
      userId: user.id,
      projectId: project.id,
      milestoneId: milestone.id,
    });

    stage = "generate-guidance";
    const generated = await runStepGuidanceGeneration({
      context: generationContext,
      selectedOption,
      roadmap: roadmapOverview,
      step: currentStep,
      previousStep,
      nextStep,
      feedback,
    });

    stage = "store-guidance";
    // Reset checklist state whenever guidance regenerates: the checklist items themselves
    // may have changed, so a previous index-keyed state would map to different items.
    const { data: storedGuidance, error: upsertError } = await supabase.from("milestone_guidance").upsert(
      {
        milestone_id: milestone.id,
        guidance_json: generated.parsed,
        email_payload_json: generated.parsed.email_version,
        raw_model_output_json: {
          guidance: generated.parsed,
          response: generated.raw,
          citations: generated.citations,
          refusal: generated.refusal,
          metrics: generated.metrics,
        },
        generation_version: generated.metrics.generation_version,
        checklist_state_json: {},
      },
      { onConflict: "milestone_id" },
    ).select("id").single();

    if (upsertError || !storedGuidance) {
      throw new Error(upsertError.message);
    }

    const routeMetadata = getRouteGenerationMetadata({
      metrics: generated.metrics,
      routeTotalMs: performance.now() - routeStartedAt,
      cacheHit: false,
    });

    stage = "consume-rate-limit";
    const completedReservationId = rateLimitReservationId;
    rateLimitReservationId = null;
    await consumeRateLimitReservation(completedReservationId);

    stage = "track-guidance";
    void trackEvent(user.id, "milestone_guidance_generated", {
      project_id: project.id,
      milestone_id: milestone.id,
      project_kind_label: project.project_kind_label,
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
        milestone_guidance_id: storedGuidance.id,
        guidance: generated.parsed,
        checklist_state: {},
        cache_hit: false,
        timings: routeMetadata,
        ...(generated.citations.length > 0 ? { citations: generated.citations } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("milestone guidance failed", { stage, error });
    captureServerError(error, { route: "ai/milestones/guidance", stage });
    const details = getErrorDetails(error);
    const status =
      error instanceof RateLimitUnavailableError
        ? 503
        : error instanceof z.ZodError && stage === "parse-request"
        ? 400
        : stage === "generate-guidance"
          ? getGenerationFailureStatus(error)
          : 500;

    return NextResponse.json(
      {
        error:
          status === 503
            ? "Step guidance is temporarily unavailable. Try again in a moment."
            : status === 400
            ? "Invalid request payload"
            : stage === "generate-guidance"
              ? getGenerationFailureMessage(error, "Failed to generate step guidance")
              : "Failed to generate step guidance",
        stage,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status },
    );
  } finally {
    if (rateLimitReservationId) {
      await releaseRateLimitReservation(rateLimitReservationId).catch((releaseError) => {
        captureServerError(releaseError, {
          route: "ai/milestones/guidance",
          stage: "release-rate-limit",
        });
      });
    }
  }
}
