import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  const { id } = await context.params;

  try {
    const workspace = await getProjectWorkspaceView(id, user.id);

    return NextResponse.json(
      {
        projectId: workspace.project.id,
        projectTitle: workspace.project.title,
        hasRoadmap: workspace.hasRoadmap,
        milestones: workspace.milestones,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
}
