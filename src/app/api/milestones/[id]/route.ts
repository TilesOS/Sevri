import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const bodySchema = z.object({
  completed: z.boolean(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  const { id } = await context.params;

  try {
    const body = bodySchema.parse(await request.json());
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("milestones")
      .update({
        completed: body.completed,
        completed_at: body.completed ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select("id, project_id, completed, completed_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const [{ data: project, error: projectError }, { data: milestones, error: milestonesError }] = await Promise.all([
      supabase.from("projects").select("id, status").eq("id", data.project_id).single(),
      supabase.from("milestones").select("completed").eq("project_id", data.project_id),
    ]);

    if (projectError || milestonesError) {
      return NextResponse.json({ error: projectError?.message ?? milestonesError?.message }, { status: 400 });
    }

    const allMilestonesComplete = (milestones ?? []).length > 0 && (milestones ?? []).every((milestone) => milestone.completed);
    let projectStatus = project.status;

    if (allMilestonesComplete && (project.status === "active" || project.status === "paused")) {
      const { data: updatedProject, error: updateProjectError } = await supabase
        .from("projects")
        .update({ status: "completed" })
        .eq("id", data.project_id)
        .select("status")
        .single();

      if (updateProjectError) {
        return NextResponse.json({ error: updateProjectError.message }, { status: 400 });
      }

      projectStatus = updatedProject.status;
    } else if (!allMilestonesComplete && project.status === "completed") {
      const { data: updatedProject, error: updateProjectError } = await supabase
        .from("projects")
        .update({ status: "active" })
        .eq("id", data.project_id)
        .select("status")
        .single();

      if (updateProjectError) {
        return NextResponse.json({ error: updateProjectError.message }, { status: 400 });
      }

      projectStatus = updatedProject.status;
    }

    return NextResponse.json({ ...data, project_status: projectStatus }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to update milestone" }, { status: 400 });
  }
}
