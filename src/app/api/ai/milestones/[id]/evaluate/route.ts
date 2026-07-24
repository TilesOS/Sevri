import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { assertFeatureAccess, createUpgradeRequiredResponse } from "@/lib/usage/feature-access";
import { runWorkEvaluation, getRouteGenerationMetadata } from "@/lib/ai/pipelines";
import { getGenerationFailureMessage, getGenerationFailureStatus } from "@/lib/ai/client";
import { coerceStoredNormalizedProfile } from "@/lib/ai/normalized-profile";
import { buildRoadmapOverviewFromStorage } from "@/lib/ai/storage";
import { StepGuidanceSchema } from "@/lib/ai/schemas";
import { trackEvent } from "@/lib/analytics/track";
import { countWords } from "@/lib/projects/output-metrics";
import { captureServerError } from "@/lib/sentry/server";
import type {
  EvaluationLifecycleStatus,
  LatestCompletedMilestoneEvaluation,
  MilestoneEvaluationResponse,
  MilestoneEvaluationState,
  StoredMilestoneSubmission,
  WorkEvaluation,
} from "@/types/domain";

export const runtime = "nodejs";

const bodySchema = z.object({
  submission_text: z.string().min(1).max(20_600),
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

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type AdminSupabaseClient = ReturnType<typeof createAdminSupabaseClient>;

type SubmissionRecord = {
  id: string;
  submission_kind: StoredMilestoneSubmission["submission_kind"];
  submission_text: string;
  submission_filename: string | null;
  created_at: string;
  updated_at: string;
};

type EvaluationRecord = {
  id: string;
  submission_id: string;
  evaluation_json: WorkEvaluation | null;
  status: EvaluationLifecycleStatus;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function getPipelineFailureMessage(raw: unknown) {
  if (raw && typeof raw === "object" && "reason" in raw && typeof raw.reason === "string" && raw.reason.trim()) {
    const reason = raw.reason.trim();

    try {
      const parsed = JSON.parse(reason) as { message?: string };
      if (typeof parsed.message === "string" && parsed.message.trim().length > 0) {
        return `Evaluation could not be completed. ${parsed.message.trim()}`;
      }
    } catch {
      // Keep the original reason when it is not JSON.
    }

    return `Evaluation could not be completed. ${reason}`;
  }

  return "Evaluation could not be completed. Your submission was saved, but you will need to submit another version to retry.";
}

function formatSubmissionResponse(submission: SubmissionRecord): StoredMilestoneSubmission {
  return {
    id: submission.id,
    submission_kind: submission.submission_kind,
    submission_text: submission.submission_text,
    submission_filename: submission.submission_filename,
    created_at: submission.created_at,
    updated_at: submission.updated_at,
  };
}

function formatCurrentEvaluationResponse(evaluation: EvaluationRecord | null): MilestoneEvaluationState {
  const status: EvaluationLifecycleStatus =
    evaluation?.status === "failed"
      ? "failed"
      : evaluation?.status === "completed" && evaluation.evaluation_json
        ? "completed"
        : "pending";

  return {
    id: evaluation?.id ?? null,
    status,
    evaluation: status === "completed" ? evaluation?.evaluation_json ?? null : null,
    failure_message:
      status === "failed"
        ? evaluation?.failure_message ?? "Evaluation failed. Submit another version to retry."
        : null,
  };
}

function getLatestCompletedEvaluation(
  submissions: SubmissionRecord[],
  evaluations: EvaluationRecord[],
): LatestCompletedMilestoneEvaluation | null {
  const completedEvaluation = evaluations.find(
    (candidate) => candidate.status === "completed" && candidate.evaluation_json,
  );
  if (!completedEvaluation) {
    return null;
  }

  const submission = submissions.find((candidate) => candidate.id === completedEvaluation.submission_id);
  if (!submission || !completedEvaluation.evaluation_json) {
    return null;
  }

  return {
    submission: formatSubmissionResponse(submission),
    evaluation: completedEvaluation.evaluation_json,
    evaluation_id: completedEvaluation.id,
  };
}

async function buildEvaluationResponse(
  supabase: ServerSupabaseClient,
  milestoneId: string,
): Promise<MilestoneEvaluationResponse> {
  const { data: submissions, error: submissionsError } = await supabase
    .from("milestone_submissions")
    .select("id, submission_kind, submission_text, submission_filename, created_at, updated_at")
    .eq("milestone_id", milestoneId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (submissionsError) {
    throw new Error(submissionsError.message);
  }

  if (!submissions?.length) {
    return {
      current_submission: null,
      current_evaluation: null,
      latest_completed_evaluation: null,
    };
  }

  const submissionRecords = submissions as SubmissionRecord[];
  const currentSubmission = submissionRecords[0];
  const submissionIds = submissionRecords.map((candidate) => candidate.id);

  let evaluationRecords: EvaluationRecord[] = [];
  if (submissionIds.length > 0) {
    const { data: evaluations, error: evaluationsError } = await supabase
      .from("milestone_submission_evaluations")
      .select("id, submission_id, evaluation_json, status, failure_message, created_at, updated_at")
      .in("submission_id", submissionIds)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (evaluationsError) {
      throw new Error(evaluationsError.message);
    }

    evaluationRecords = (evaluations ?? []) as EvaluationRecord[];
  }

  const evaluationBySubmission = new Map<string, EvaluationRecord>();
  for (const evaluation of evaluationRecords) {
    if (!evaluationBySubmission.has(evaluation.submission_id)) {
      evaluationBySubmission.set(evaluation.submission_id, evaluation);
    }
  }

  return {
    current_submission: formatSubmissionResponse(currentSubmission),
    current_evaluation: formatCurrentEvaluationResponse(
      evaluationBySubmission.get(currentSubmission.id) ?? null,
    ),
    latest_completed_evaluation: getLatestCompletedEvaluation(submissionRecords, evaluationRecords),
  };
}

async function markEvaluationFailed(
  adminSupabase: AdminSupabaseClient,
  evaluationId: string,
  failureMessage: string,
  stage: string,
) {
  const { error } = await adminSupabase.rpc("fail_milestone_submission_evaluation", {
    p_evaluation_id: evaluationId,
    p_failure_message: failureMessage,
  });

  if (error) {
    console.error("failed to mark evaluation as failed", { stage, error });
    captureServerError(error, { route: "ai/milestones/evaluate", stage });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const routeStartedAt = performance.now();
  let stage = "start";
  let supabase: ServerSupabaseClient | null = null;
  let adminSupabase: AdminSupabaseClient | null = null;
  let recoveryMilestoneId: string | null = null;
  let savedEvaluationId: string | null = null;

  try {
    stage = "auth";
    const { user, response } = await requireApiUser();
    if (!user) {
      return response;
    }

    stage = "parse-request";
    const body = bodySchema.parse(await request.json());
    const { id } = await context.params;
    recoveryMilestoneId = id;

    stage = "rate-limit";
    try {
      const rateLimit = await enforceRateLimit({
        userId: user.id,
        endpoint: "milestone-evaluate",
        maxRequests: 8,
        windowMinutes: 60,
      });

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Rate limit exceeded", reset_at: rateLimit.resetAt },
          { status: 429 },
        );
      }
    } catch (rateLimitError) {
      console.error("work evaluation rate-limit failed", { stage, error: rateLimitError });
      captureServerError(rateLimitError, {
        route: "ai/milestones/evaluate",
        stage: "rate-limit",
      });
    }

    stage = "feature-access";
    const featureAccess = await assertFeatureAccess({
      userId: user.id,
      feature: "step_guidance",
    });

    if (!featureAccess.allowed) {
      return createUpgradeRequiredResponse(featureAccess.error);
    }

    stage = "create-supabase-client";
    supabase = await createServerSupabaseClient();
    adminSupabase = createAdminSupabaseClient();

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

    stage = "insert-submission-and-evaluation";
    const { data: persisted, error: persistError } = await supabase
      .rpc("create_milestone_submission_with_pending_evaluation", {
        p_milestone_id: milestone.id,
        p_submission_kind: body.submission_kind,
        p_submission_text: body.submission_text,
        p_submission_filename: body.submission_filename ?? null,
      })
      .single();

    if (persistError || !persisted) {
      throw new Error(persistError?.message ?? "Failed to save submission");
    }

    const persistedRecord = persisted as {
      submission_id: string;
      evaluation_id: string;
    };

    savedEvaluationId = persistedRecord.evaluation_id;

    try {
      stage = "evaluate";
      const generated = await runWorkEvaluation({
        context: generationContext,
        step: currentStep,
        guidance,
        submissionText: body.submission_text,
        submissionFilename: body.submission_filename,
      });

      const generatedRaw = generated.raw && typeof generated.raw === "object"
        ? (generated.raw as Record<string, unknown>)
        : null;
      const generatedSource = typeof generatedRaw?.source === "string" ? generatedRaw.source : null;

      if (generatedSource === "fallback") {
        const failureMessage = getPipelineFailureMessage(generated.raw);
        stage = "mark-evaluation-failed";
        await markEvaluationFailed(
          adminSupabase,
          persistedRecord.evaluation_id,
          failureMessage,
          stage,
        );

        return NextResponse.json({ error: failureMessage }, { status: 502 });
      }

      stage = "mark-evaluation-completed";
      const { error: evaluationUpdateError } = await adminSupabase.rpc(
        "complete_milestone_submission_evaluation",
        {
          p_evaluation_id: persistedRecord.evaluation_id,
          p_evaluation_json: generated.parsed,
        },
      );

      if (evaluationUpdateError) {
        console.error("failed to persist completed evaluation", { stage, error: evaluationUpdateError });
        captureServerError(evaluationUpdateError, { route: "ai/milestones/evaluate", stage });

        stage = "mark-evaluation-failed";
        await markEvaluationFailed(
          adminSupabase,
          persistedRecord.evaluation_id,
          "Evaluation finished, but the result could not be saved. Your submission is still available - submit another version to retry.",
          stage,
        );

        return NextResponse.json(await buildEvaluationResponse(supabase, milestone.id), { status: 200 });
      }

      const routeMetadata = getRouteGenerationMetadata({
        metrics: generated.metrics,
        routeTotalMs: performance.now() - routeStartedAt,
        cacheHit: false,
      });

      stage = "track-evaluation";
      const projectTrack = project.project_track === "research" ? "research" : "software";
      void trackEvent(user.id, "work_evaluation_completed", {
        project_id: project.id,
        milestone_id: milestone.id,
        submission_id: persistedRecord.submission_id,
        project_track: projectTrack,
        ...(projectTrack === "research"
          ? { submission_word_count: countWords(body.submission_text) }
          : {}),
        ...routeMetadata,
      }).catch((trackError) => {
        console.error("work evaluation track failed", { stage, error: trackError });
        captureServerError(trackError, {
          route: "ai/milestones/evaluate",
          stage: "track-evaluation",
        });
      });

      return NextResponse.json(await buildEvaluationResponse(supabase, milestone.id), { status: 200 });
    } catch (evaluationError) {
      const failureMessage = getGenerationFailureMessage(
        evaluationError,
        getErrorMessage(
          evaluationError,
          "Evaluation failed, but your submission was saved. Submit another version to retry.",
        ),
      );
      stage = "mark-evaluation-failed";
      await markEvaluationFailed(
        adminSupabase,
        persistedRecord.evaluation_id,
        failureMessage,
        stage,
      );

      return NextResponse.json(
        { error: failureMessage },
        { status: getGenerationFailureStatus(evaluationError) },
      );
    }
  } catch (error) {
    console.error("work evaluation failed", { stage, error });
    captureServerError(error, { route: "ai/milestones/evaluate", stage });

    if (supabase && recoveryMilestoneId && savedEvaluationId) {
      try {
        return NextResponse.json(await buildEvaluationResponse(supabase, recoveryMilestoneId), { status: 200 });
      } catch (recoveryError) {
        console.error("failed to recover saved submission state", { recoveryError });
        captureServerError(recoveryError, {
          route: "ai/milestones/evaluate",
          stage: "recover-saved-submission",
        });
      }
    }

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
    const featureAccess = await assertFeatureAccess({
      userId: user.id,
      feature: "step_guidance",
    });

    if (!featureAccess.allowed) {
      return createUpgradeRequiredResponse(featureAccess.error);
    }

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

    return NextResponse.json(await buildEvaluationResponse(supabase, milestone.id), { status: 200 });
  } catch (error) {
    console.error("get evaluation failed", { error });
    captureServerError(error, { route: "ai/milestones/evaluate", stage: "get" });

    return NextResponse.json(
      { error: "Failed to load evaluation" },
      { status: 500 },
    );
  }
}
