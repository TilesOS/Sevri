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

const bodySchema = z.object({
  project_id: z.string().uuid(),
});

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
      .select("id, title, recommendation_id")
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
      .select("summary, interpreted_interests, skill_assessment, risk_flags")
      .eq("id", recommendation.normalized_profile_id)
      .eq("user_id", user.id)
      .single();

    if (profileError || !normalizedProfile) {
      return NextResponse.json({ error: "Normalized profile not found" }, { status: 400 });
    }

    const generated = await runRoadmapGeneration({
      selectedProject: recommendation,
      normalizedProfile: {
        summary: normalizedProfile.summary,
        interpreted_interests: normalizedProfile.interpreted_interests,
        skill_assessment: normalizedProfile.skill_assessment as "beginner" | "intermediate" | "advanced",
        risk_flags: normalizedProfile.risk_flags as Array<
          "too_ambitious" | "too_vague" | "too_advanced" | "too_little_time" | "misaligned_goal"
        >,
      },
      detailLevel,
    });

    const { data: roadmap, error: roadmapError } = await supabase
      .from("project_roadmaps")
      .upsert(
        {
          project_id: project.id,
          overview: generated.parsed.overview,
          mvp_scope: generated.parsed.mvp_scope,
          repo_structure: generated.parsed.repo_structure,
          readme_draft: generated.parsed.readme_draft,
          stretch_goals: generated.parsed.stretch_goals,
          explanation_guide: generated.parsed.explanation_guide,
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

    await trackEvent(user.id, "roadmap_generated", { project_id: project.id, roadmap_id: roadmap.id, detailLevel });

    if (user.email) {
      const template = roadmapReadyTemplate(project.title);
      await sendEmail(user.email, template.subject, template.html);
    }

    return NextResponse.json({ roadmap_id: roadmap.id, detailLevel }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "ai/roadmap" });
    return NextResponse.json({ error: "Failed to generate roadmap" }, { status: 500 });
  }
}