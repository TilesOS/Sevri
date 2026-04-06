import { notFound } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";
import { ProjectRoadmapEmptyState } from "@/components/project/project-roadmap-empty-state";
import { ProjectOverviewView } from "@/components/project/project-overview-view";

export default async function ProjectOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();
  const { id } = await params;

  try {
    const [workspace, plan] = await Promise.all([
      getProjectWorkspaceView(id, user.id),
      getUserPlan(user.id),
    ]);

    if (!workspace.hasRoadmap) {
      return (
        <ProjectRoadmapEmptyState
          projectId={workspace.project.id}
          projectTitle={workspace.project.title}
          projectTrack={workspace.projectTrack}
          plan={plan}
        />
      );
    }

    return <ProjectOverviewView workspace={workspace} plan={plan} />;
  } catch {
    notFound();
  }
}
