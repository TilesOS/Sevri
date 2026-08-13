import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { trackEvent } from "@/lib/analytics/track";
import { captureServerError } from "@/lib/sentry/server";

const payloadSchema = z.object({
  stage: z.enum(["recommendations", "roadmap", "step_guidance", "work_evaluation"]),
  signal: z.enum(["good", "mixed", "bad"]),
  notes: z.string().trim().max(500).optional(),
  normalized_profile_id: z.string().uuid().optional(),
  closest_recommendation_id: z.string().uuid().optional(),
  roadmap_id: z.string().uuid().optional(),
  milestone_guidance_id: z.string().uuid().optional(),
  submission_evaluation_id: z.string().uuid().optional(),
});

function cleanNotes(value: string | undefined) {
  const notes = value?.trim();
  return notes ? notes : null;
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const payload = payloadSchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();
    const notes = cleanNotes(payload.notes);

    let insertPayload: Record<string, unknown> = {
      user_id: user.id,
      stage: payload.stage,
      signal: payload.signal,
      notes,
    };

    if (payload.stage === "recommendations") {
      if (!payload.normalized_profile_id) {
        return NextResponse.json({ error: "normalized_profile_id is required." }, { status: 400 });
      }

      const { data: normalizedProfile, error: normalizedProfileError } = await supabase
        .from("normalized_profiles")
        .select("id")
        .eq("id", payload.normalized_profile_id)
        .eq("user_id", user.id)
        .single();

      if (normalizedProfileError || !normalizedProfile) {
        return NextResponse.json({ error: "Normalized profile not found." }, { status: 404 });
      }

      let closestRecommendationId: string | null = null;
      if (payload.closest_recommendation_id) {
        const { data: recommendation, error: recommendationError } = await supabase
          .from("project_recommendations")
          .select("id")
          .eq("id", payload.closest_recommendation_id)
          .eq("user_id", user.id)
          .single();

        if (recommendationError || !recommendation) {
          return NextResponse.json({ error: "Closest recommendation not found." }, { status: 404 });
        }

        closestRecommendationId = recommendation.id;
      }

      insertPayload = {
        ...insertPayload,
        normalized_profile_id: normalizedProfile.id,
        closest_recommendation_id: closestRecommendationId,
      };
    }

    if (payload.stage === "roadmap") {
      if (!payload.roadmap_id) {
        return NextResponse.json({ error: "roadmap_id is required." }, { status: 400 });
      }

      const { data: roadmap, error: roadmapError } = await supabase
        .from("project_roadmaps")
        .select("id, project_id")
        .eq("id", payload.roadmap_id)
        .single();

      if (roadmapError || !roadmap) {
        return NextResponse.json({ error: "Roadmap not found." }, { status: 404 });
      }

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", roadmap.project_id)
        .eq("user_id", user.id)
        .single();

      if (projectError || !project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }

      insertPayload = {
        ...insertPayload,
        roadmap_id: roadmap.id,
        project_id: roadmap.project_id,
      };
    }

    if (payload.stage === "step_guidance") {
      if (!payload.milestone_guidance_id) {
        return NextResponse.json({ error: "milestone_guidance_id is required." }, { status: 400 });
      }

      const { data: guidance, error: guidanceError } = await supabase
        .from("milestone_guidance")
        .select("id, milestone_id")
        .eq("id", payload.milestone_guidance_id)
        .single();

      if (guidanceError || !guidance) {
        return NextResponse.json({ error: "Milestone guidance not found." }, { status: 404 });
      }

      const { data: milestone, error: milestoneError } = await supabase
        .from("milestones")
        .select("id, project_id")
        .eq("id", guidance.milestone_id)
        .single();

      if (milestoneError || !milestone) {
        return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
      }

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", milestone.project_id)
        .eq("user_id", user.id)
        .single();

      if (projectError || !project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }

      insertPayload = {
        ...insertPayload,
        milestone_guidance_id: guidance.id,
        milestone_id: milestone.id,
        project_id: project.id,
      };
    }

    if (payload.stage === "work_evaluation") {
      if (!payload.submission_evaluation_id) {
        return NextResponse.json({ error: "submission_evaluation_id is required." }, { status: 400 });
      }

      const { data: evaluation, error: evaluationError } = await supabase
        .from("milestone_submission_evaluations")
        .select("id, submission_id")
        .eq("id", payload.submission_evaluation_id)
        .single();

      if (evaluationError || !evaluation) {
        return NextResponse.json({ error: "Submission evaluation not found." }, { status: 404 });
      }

      const { data: submission, error: submissionError } = await supabase
        .from("milestone_submissions")
        .select("id, milestone_id")
        .eq("id", evaluation.submission_id)
        .single();

      if (submissionError || !submission) {
        return NextResponse.json({ error: "Submission not found." }, { status: 404 });
      }

      const { data: milestone, error: milestoneError } = await supabase
        .from("milestones")
        .select("id, project_id")
        .eq("id", submission.milestone_id)
        .single();

      if (milestoneError || !milestone) {
        return NextResponse.json({ error: "Milestone not found." }, { status: 404 });
      }

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", milestone.project_id)
        .eq("user_id", user.id)
        .single();

      if (projectError || !project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }

      insertPayload = {
        ...insertPayload,
        submission_evaluation_id: evaluation.id,
        milestone_id: milestone.id,
        project_id: project.id,
      };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("generation_feedback")
      .insert(insertPayload)
      .select("id, stage, signal")
      .single();

    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Failed to save feedback.");
    }

    void trackEvent(user.id, "generation_feedback_submitted", {
      stage: payload.stage,
      signal: payload.signal,
      ...("project_id" in insertPayload ? { project_id: insertPayload.project_id } : {}),
    }).catch((trackError) => {
      captureServerError(trackError, {
        route: "ai/feedback",
        stage: "track-feedback",
      });
    });

    return NextResponse.json(
      {
        id: inserted.id,
        stage: inserted.stage,
        signal: inserted.signal,
      },
      { status: 200 },
    );
  } catch (error) {
    captureServerError(error, { route: "ai/feedback" });
    return NextResponse.json({ error: "Failed to save feedback." }, { status: 400 });
  }
}
