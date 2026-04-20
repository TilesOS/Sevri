import { notFound } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";
import { listProjectInvitations, listProjectReviewers } from "@/lib/db/queries/reviewers";
import { getUserIntegrationPublic } from "@/lib/db/queries/github";
import { ProjectRoadmapEmptyState } from "@/components/project/project-roadmap-empty-state";
import { ProjectOverviewView } from "@/components/project/project-overview-view";

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ schedule?: string }>;
}) {
  const user = await getRequiredUser();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  try {
    const [workspace, plan, reviewers, invitations, githubIntegration] = await Promise.all([
      getProjectWorkspaceView(id, user.id),
      getUserPlan(user.id),
      listProjectReviewers(id),
      listProjectInvitations(id),
      getUserIntegrationPublic(user.id, "github"),
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

    return (
      <ProjectOverviewView
        workspace={workspace}
        plan={plan}
        reviewers={reviewers}
        invitations={invitations}
        githubIntegration={githubIntegration}
        showScheduleRetryNotice={resolvedSearchParams?.schedule === "retry"}
      />
    );
  } catch {
    notFound();
  }
}
