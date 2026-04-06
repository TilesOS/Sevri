import { notFound, redirect } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";
import { ProjectResearchLensView } from "@/components/project/project-research-lens-view";

export default async function ProjectResearchLensPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();
  const { id } = await params;

  try {
    const workspace = await getProjectWorkspaceView(id, user.id);

    if (!workspace.hasRoadmap) {
      redirect(`/project/${id}`);
    }

    return <ProjectResearchLensView workspace={workspace} />;
  } catch {
    notFound();
  }
}
