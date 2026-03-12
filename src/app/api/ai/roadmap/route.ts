import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { runRoadmapGeneration } from "@/lib/ai/pipelines";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { hasRoadmapDetailAccess } from "@/lib/usage/limits";
import { trackEvent } from "@/lib/analytics/events";
import { captureServerError } from "@/lib/sentry/server";
import { sendEmail } from "@/lib/email/resend";
import { roadmapReadyTemplate } from "@/lib/email/templates";
import { coerceStoredNormalizedProfile } from "@/lib/ai/normalized-profile";

const bodySchema = z.object({
  project_id: z.string().uuid(),
});

function asProjectTrack(value: unknown): "software" | "research" {
  return value === "research" ? "research" : "software";
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const body = bodySchema.parse(await request.json());

    const rateLimit = await enforceRateLimit({
      userId: user.id,
      endpoint: "roadmap",
      maxRequests: 8,
      windowMinutes: 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", reset_at: rateLimit.resetAt },
        { status: 429 },
      );
    }

    const plan = await getUserPlan(user.id);
    const detailLevel = hasRoadmapDetailAccess(plan) ? "full" : "limited";

    const supabase = await createServerSupabaseClient();

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, title, recommendation_id, project_track")
      .eq("id", body.project_id)
      .eq("user_id", user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: recommendation, error: recommendationError } = await supabase
      .from("project_recommendations")
      .select("*")
      .eq("id", project.recommendation_id)
      .eq("user_id", user.id)
      .single();

    if (recommendationError || !recommendation) {
      return NextResponse.json({ error: "Recommendation not found" }, { status: 400 });
    }

    const { data: normalizedProfile, error: profileError } = await supabase
      .from("normalized_profiles")
      .select("summary, interpreted_interests, skill_assessment, risk_flags, project_track, track_payload_json")
      .eq("id", recommendation.normalized_profile_id)
      .eq("user_id", user.id)
      .single();

    if (profileError || !normalizedProfile) {
      return NextResponse.json({ error: "Normalized profile not found" }, { status: 400 });
    }

    const profile = coerceStoredNormalizedProfile({
      summary: normalizedProfile.summary,
      interpreted_interests: normalizedProfile.interpreted_interests,
      skill_assessment: normalizedProfile.skill_assessment,
      risk_flags: normalizedProfile.risk_flags,
      project_track: normalizedProfile.project_track,
      track_payload_json: normalizedProfile.track_payload_json,
    });

    const generated = await runRoadmapGeneration({
      selectedProject: recommendation,
      normalizedProfile: profile,
      detailLevel,
    });

    const projectTrack = asProjectTrack(project.project_track ?? recommendation.project_track ?? profile.project_track);

    const { data: roadmap, error: roadmapError } = await supabase
      .from("project_roadmaps")
      .upsert(
        {
          project_id: project.id,
          project_track: projectTrack,
          overview: generated.parsed.overview,
          mvp_scope: generated.parsed.mvp_scope,
          repo_structure: generated.parsed.repo_structure,
          readme_draft: generated.parsed.readme_draft,
          stretch_goals: generated.parsed.stretch_goals,
          explanation_guide: generated.parsed.explanation_guide,
          track_payload_json: generated.parsed.track_payload_json,
          raw_model_output_json: generated.raw,
        },
        { onConflict: "project_id" },
      )
      .select("id")
      .single();

    if (roadmapError) {
      throw new Error(roadmapError.message);
    }

    await supabase.from("milestones").delete().eq("project_id", project.id);

    const milestonePayload = generated.parsed.milestones.map((milestone) => ({
      project_id: project.id,
      order_index: milestone.order_index,
      title: milestone.title,
      description: milestone.description,
      completed: false,
      completed_at: null,
    }));

    const { error: milestoneError } = await supabase.from("milestones").insert(milestonePayload);
    if (milestoneError) {
      throw new Error(milestoneError.message);
    }

    const postGenerateTasks: Promise<unknown>[] = [
      trackEvent(user.id, "roadmap_generated", {
        project_id: project.id,
        roadmap_id: roadmap.id,
        detailLevel,
        project_track: projectTrack,
      }),
    ];

    if (user.email) {
      const template = roadmapReadyTemplate(project.title);
      postGenerateTasks.push(sendEmail(user.email, template.subject, template.html));
    }

    const taskResults = await Promise.allSettled(postGenerateTasks);
    taskResults.forEach((result) => {
      if (result.status === "rejected") {
        captureServerError(result.reason, {
          route: "ai/roadmap",
          stage: "post-generate-task",
        });
      }
    });

    return NextResponse.json({ roadmap_id: roadmap.id, detailLevel, project_track: projectTrack }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "ai/roadmap" });
    return NextResponse.json({ error: "Failed to generate roadmap" }, { status: 500 });
  }
}
