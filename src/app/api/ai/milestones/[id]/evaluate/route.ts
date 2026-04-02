import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runWorkEvaluation, getRouteGenerationMetadata } from "@/lib/ai/pipelines";
import { coerceStoredNormalizedProfile } from "@/lib/ai/normalized-profile";
import { buildRoadmapOverviewFromStorage } from "@/lib/ai/storage";
import { StepGuidanceSchema } from "@/lib/ai/schemas";
import { trackEvent } from "@/lib/analytics/events";
import { captureServerError } from "@/lib/sentry/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  submission_text: z.string().min(1).max(20_000),
  submission_kind: z.enum(["pasted_text", "file_upload"]),
  submission_filename: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.submission_kind === "file_upload" && !data.submission_filename) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["submission_filename"],
      message: "submission_filename is required when submission_kind is file_upload",
    });
  }
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

function formatSubmissionResponse(submission: {
  id: string;
  submission_kind: string;
  submission_filename: string | null;
  created_at: string;
  updated_at: string;
}) {
  return {
    id: submission.id,
    submission_kind: submission.submission_kind,
    submission_filename: submission.submission_filename,
    created_at: submission.created_at,
    updated_at: submission.updated_at,
  };
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
    const body = bodySchema.parse(await request.json());
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

    stage = "fetch-guidance";
    const { data: guidanceRow } = await supabase
      .from("milestone_guidance")
      .select("guidance_json")
      .eq("milestone_id", milestone.id)
      .maybeSingle();

    if (!guidanceRow) {
      return NextResponse.json(
        { error: "Open the step guidance before submitting work" },
        { status: 400 },
      );
    }

    let guidance;
    try {
      guidance = StepGuidanceSchema.parse(guidanceRow.guidance_json);
    } catch {
      return NextResponse.json(
        { error: "Stored guidance is malformed. Refresh guidance and try again." },
        { status: 400 },
      );
    }

    stage = "insert-submission";
    const { data: submission, error: insertError } = await supabase
      .from("milestone_submissions")
      .insert({
        milestone_id: milestone.id,
        user_id: user.id,
        submission_kind: body.submission_kind,
        submission_text: body.submission_text,
        submission_filename: body.submission_filename ?? null,
        is_latest: true,
      })
      .select("id, submission_kind, submission_filename, created_at, updated_at")
      .single();

    if (insertError || !submission) {
      throw new Error(insertError?.message ?? "Failed to insert submission");
    }

    stage = "evaluate";
    const generated = await runWorkEvaluation({
      context: generationContext,
      step: currentStep,
      guidance,
      submissionText: body.submission_text,
      submissionFilename: body.submission_filename,
    });

    stage = "insert-evaluation";
    const { data: evaluation, error: evalInsertError } = await supabase
      .from("milestone_submission_evaluations")
      .insert({
        submission_id: submission.id,
        user_id: user.id,
        evaluation_json: generated.parsed,
        status: "completed",
      })
      .select("id, created_at")
      .single();

    if (evalInsertError || !evaluation) {
      throw new Error(evalInsertError?.message ?? "Failed to insert evaluation");
    }

    const routeMetadata = getRouteGenerationMetadata({
      metrics: generated.metrics,
      routeTotalMs: performance.now() - routeStartedAt,
      cacheHit: false,
    });

    stage = "track-evaluation";
    void trackEvent(user.id, "work_evaluation_completed", {
      project_id: project.id,
      milestone_id: milestone.id,
      submission_id: submission.id,
      project_track: project.project_track === "research" ? "research" : "software",
      ...routeMetadata,
    }).catch((trackError) => {
      console.error("work evaluation track failed", { stage, error: trackError });
      captureServerError(trackError, {
        route: "ai/milestones/evaluate",
        stage: "track-evaluation",
      });
    });

    return NextResponse.json(
      {
        submission: formatSubmissionResponse(submission),
        evaluation: generated.parsed,
        evaluation_id: evaluation.id,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("work evaluation failed", { stage, error });
    captureServerError(error, { route: "ai/milestones/evaluate", stage });
    const details = getErrorDetails(error);
    const status = error instanceof z.ZodError && stage === "parse-request" ? 400 : 500;

    return NextResponse.json(
      {
        error: status === 400 ? "Invalid request payload" : "Failed to evaluate submission",
        stage,
        details: process.env.NODE_ENV === "development" ? details : undefined,
      },
      { status },
    );
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, response } = await requireApiUser();
    if (!user) {
      return response;
    }

    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();

    const { data: milestone, error: milestoneError } = await supabase
      .from("milestones")
      .select("id, project_id")
      .eq("id", id)
      .single();

    if (milestoneError || !milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", milestone.project_id)
      .eq("user_id", user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: submission } = await supabase
      .from("milestone_submissions")
      .select("id, submission_kind, submission_filename, created_at, updated_at")
      .eq("milestone_id", milestone.id)
      .eq("is_latest", true)
      .limit(1)
      .maybeSingle();

    if (!submission) {
      return NextResponse.json({ submission: null, evaluation: null }, { status: 200 });
    }

    const { data: evaluation } = await supabase
      .from("milestone_submission_evaluations")
      .select("id, evaluation_json, created_at")
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json(
      {
        submission: formatSubmissionResponse(submission),
        evaluation: evaluation?.evaluation_json ?? null,
        evaluation_id: evaluation?.id ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("get evaluation failed", { error });
    captureServerError(error, { route: "ai/milestones/evaluate", stage: "get" });

    return NextResponse.json(
      { error: "Failed to load evaluation" },
      { status: 500 },
    );
  }
}
