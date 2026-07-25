import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { RATE_LIMITED_MESSAGE } from "@/lib/errors/user-messages";
import { runRoadmapGeneration, getRouteGenerationMetadata } from "@/lib/ai/pipelines";
import { getGenerationFailureMessage, getGenerationFailureStatus } from "@/lib/ai/client";
import { coerceStoredNormalizedProfile } from "@/lib/ai/normalized-profile";
import { buildMilestoneInsert, buildRoadmapStorageArtifacts, coerceStoredProjectOption } from "@/lib/ai/storage";
import { normalizeTimeZone } from "@/lib/calendar/date-utils";
import { generateProjectSchedule } from "@/lib/calendar/schedule";
import { clearProjectSchedule, persistProjectSchedule } from "@/lib/db/mutations/calendar";
import { getProjectScheduleGenerationContext } from "@/lib/db/queries/calendar";
import { getRoadmapFeedback } from "@/lib/db/queries/generation-feedback";
import { syncProjectToGoogleCalendar } from "@/lib/integrations/google-calendar/sync";
import { trackEvent } from "@/lib/analytics/track";
import { captureServerError } from "@/lib/sentry/server";
import { sendEmail } from "@/lib/email/resend";
import { roadmapReadyTemplate } from "@/lib/email/templates";

export const runtime = "nodejs";

const bodySchema = z.object({
  project_id: z.string().uuid(),
  timezone: z.string().min(1).max(120).optional(),
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

function asProjectTrack(value: unknown): "software" | "research" {
  return value === "research" ? "research" : "software";
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
        endpoint: "roadmap",
        maxRequests: 8,
        windowMinutes: 60,
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: RATE_LIMITED_MESSAGE, code: "rate_limited", reset_at: rateLimit.resetAt },
          { status: 429 },
        );
      }
    } catch (rateLimitError) {
      console.error("roadmap rate-limit failed", { stage, error: rateLimitError });
      captureServerError(rateLimitError, {
        route: "ai/roadmap",
        stage: "rate-limit",
      });
    }

    stage = "create-supabase-client";
    const supabase = await createServerSupabaseClient();

    stage = "fetch-project";
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, title, recommendation_id, project_track")
      .eq("id", body.project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
    const { data: contextRow, error: profileError } = await supabase
      .from("normalized_profiles")
      .select("summary, interpreted_interests, skill_assessment, risk_flags, project_track, track_payload_json")
      .eq("id", recommendation.normalized_profile_id)
      .eq("user_id", user.id)
      .single();

    if (profileError || !contextRow) {
      return NextResponse.json({ error: "Generation context not found" }, { status: 400 });
    }

    const context = coerceStoredNormalizedProfile({
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

    stage = "load-feedback";
    const feedback = await getRoadmapFeedback({
      userId: user.id,
      projectId: project.id,
      normalizedProfileId: recommendation.normalized_profile_id,
      selectedRecommendationId: recommendation.id,
    });

    stage = "generate-roadmap";
    const generated = await runRoadmapGeneration({
      context,
      selectedOption,
      feedback,
    });

    const storageArtifacts = buildRoadmapStorageArtifacts({
      context,
      selectedOption,
      roadmap: generated.parsed,
    });
    const projectTrack = asProjectTrack(project.project_track ?? recommendation.project_track ?? context.project_track);

    stage = "upsert-roadmap";
    const scheduleTimezone = normalizeTimeZone(body.timezone);
    const { data: roadmap, error: roadmapError } = await supabase
      .from("project_roadmaps")
      .upsert(
        {
          project_id: project.id,
          project_track: projectTrack,
          overview: generated.parsed.short_overview,
          mvp_scope: storageArtifacts.mvpScope,
          repo_structure: storageArtifacts.repoStructure,
          readme_draft: storageArtifacts.readmeDraft,
          stretch_goals: storageArtifacts.stretchGoals,
          explanation_guide: storageArtifacts.explanationGuide,
          track_payload_json: storageArtifacts.trackPayloadJson,
          scheduled_start_date: null,
          scheduled_end_date: null,
          schedule_timezone: scheduleTimezone,
          schedule_generation_source: null,
          last_schedule_rebalanced_at: null,
          raw_model_output_json: {
            roadmap: generated.parsed,
            response: generated.raw,
            citations: generated.citations,
            refusal: generated.refusal,
            metrics: generated.metrics,
          },
        },
        { onConflict: "project_id" },
      )
      .select("id")
      .single();

    if (roadmapError) {
      throw new Error(roadmapError.message);
    }

    stage = "reset-milestones";
    const { error: deleteMilestonesError } = await supabase.from("milestones").delete().eq("project_id", project.id);
    if (deleteMilestonesError) {
      throw new Error(deleteMilestonesError.message);
    }

    stage = "insert-milestones";
    const { data: insertedMilestones, error: milestoneError } = await supabase.from("milestones").insert(
      generated.parsed.steps.map((step) => ({
        project_id: project.id,
        ...buildMilestoneInsert(step),
        completed: false,
        completed_at: null,
      })),
    )
      .select("id, order_index, title, rough_time_estimate, due_date, schedule_duration_days, is_user_scheduled_override, completed");

    if (milestoneError || !insertedMilestones) {
      throw new Error(milestoneError?.message ?? "Failed to insert milestones.");
    }

    let scheduleReady = false;

    try {
      stage = "reset-schedule";
      await clearProjectSchedule({
        projectId: project.id,
        timeZone: scheduleTimezone,
        client: supabase,
      });

      stage = "generate-schedule";
      const schedule = generateProjectSchedule({
        milestones: insertedMilestones.map((milestone) => ({
          id: milestone.id,
          orderIndex: milestone.order_index,
          stepNumber: milestone.order_index + 1,
          title: milestone.title,
          roughTimeEstimate: milestone.rough_time_estimate,
          dueDate: milestone.due_date,
          scheduleDurationDays: milestone.schedule_duration_days,
          completed: milestone.completed,
          isUserScheduledOverride: milestone.is_user_scheduled_override,
        })),
        estimatedWeeks: recommendation.estimated_weeks,
        weeklyHours: recommendation.weekly_hours,
        projectTrack,
        timeZone: scheduleTimezone,
      });

      stage = "persist-schedule";
      await persistProjectSchedule({
        projectId: project.id,
        schedule,
        source: "roadmap_generation",
        client: supabase,
      });
      scheduleReady = true;

      stage = "google-calendar-sync";
      const refreshedProject = await getProjectScheduleGenerationContext(project.id, user.id);
      await syncProjectToGoogleCalendar({
        userId: user.id,
        project: refreshedProject,
      }).catch((syncError) => {
        captureServerError(syncError, {
          route: "ai/roadmap",
          stage: "google-calendar-sync",
          project_id: project.id,
          roadmap_id: roadmap.id,
        });
      });
    } catch (scheduleError) {
      console.error("roadmap schedule failed", { stage, error: scheduleError });
      captureServerError(scheduleError, {
        route: "ai/roadmap",
        stage: "schedule-generation",
        project_id: project.id,
        roadmap_id: roadmap.id,
      });
      stage = "post-generate";
    }

    const routeMetadata = getRouteGenerationMetadata({
      metrics: generated.metrics,
      routeTotalMs: performance.now() - routeStartedAt,
      cacheHit: false,
    });

    stage = "post-generate";
    void trackEvent(user.id, "roadmap_generated", {
      project_id: project.id,
      roadmap_id: roadmap.id,
      project_track: projectTrack,
      schedule_ready: scheduleReady,
      ...routeMetadata,
    }).catch((trackError) => {
      console.error("roadmap track failed", { stage, error: trackError });
      captureServerError(trackError, {
        route: "ai/roadmap",
        stage: "track-roadmap-generated",
      });
    });

    if (user.email) {
      const template = roadmapReadyTemplate(project.title);
      void sendEmail(user.email, template.subject, template.html).catch((emailError) => {
        console.error("roadmap email failed", { stage, error: emailError });
        captureServerError(emailError, {
          route: "ai/roadmap",
          stage: "send-roadmap-email",
        });
      });
    }

    return NextResponse.json(
      {
        roadmap_id: roadmap.id,
        project_track: projectTrack,
        schedule_ready: scheduleReady,
        timings: routeMetadata,
        ...(generated.citations.length > 0 ? { citations: generated.citations } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("roadmap failed", { stage, error });
    captureServerError(error, { route: "ai/roadmap", stage });
    const details = getErrorDetails(error);
    const status =
      error instanceof z.ZodError && stage === "parse-request"
        ? 400
        : stage === "generate-roadmap"
          ? getGenerationFailureStatus(error)
          : 500;

    return NextResponse.json(
      {
        error:
          status === 400
            ? "Invalid request payload"
            : stage === "generate-roadmap"
              ? getGenerationFailureMessage(error, "Failed to generate roadmap")
              : "Failed to generate roadmap",
        stage,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status },
    );
  }
}
