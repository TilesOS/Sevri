import type { Metadata } from "next";
import { notFound, unstable_rethrow } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { buildProjectMetadata } from "@/lib/projects/metadata";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";
import { listProjectInvitations, listProjectReviewers } from "@/lib/db/queries/reviewers";
import { getUserIntegrationPublic } from "@/lib/db/queries/github";
import { ProjectRoadmapEmptyState } from "@/components/project/project-roadmap-empty-state";
import { ProjectOverviewView } from "@/components/project/project-overview-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return buildProjectMetadata(id);
}

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
          projectKindLabel={workspace.projectKindLabel}
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
  } catch (error) {
    unstable_rethrow(error);
    notFound();
  }
}
