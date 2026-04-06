import { notFound } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";
import { ProjectSidebarNavigation } from "@/components/project/project-sidebar-navigation";

export default async function ProjectNavSlot({
  params,
}: {
  params: Promise<{ id: string; slug?: string[] }>;
}) {
  const user = await getRequiredUser();
  const { id } = await params;

  try {
    const workspace = await getProjectWorkspaceView(id, user.id);

    return (
      <ProjectSidebarNavigation
        projectId={workspace.project.id}
        projectTitle={workspace.project.title}
        hasRoadmap={workspace.hasRoadmap}
        milestones={workspace.milestones}
      />
    );
  } catch {
    notFound();
  }
}
