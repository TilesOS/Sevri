import { notFound, redirect } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";
import { listMilestoneReviews } from "@/lib/db/queries/reviewers";
import { ProjectStepWorkspace } from "@/components/project/project-step-workspace";
import { ReviewerFeedbackPanel } from "@/components/reviewer/reviewer-feedback-panel";

export default async function ProjectStepPage({
  params,
}: {
  params: Promise<{ id: string; step: string }>;
}) {
  const user = await getRequiredUser();
  const { id, step } = await params;
  const stepNumber = Number.parseInt(step, 10);

  if (!Number.isInteger(stepNumber) || stepNumber < 1) {
    notFound();
  }

  try {
    const [workspace, plan] = await Promise.all([
      getProjectWorkspaceView(id, user.id),
      getUserPlan(user.id),
    ]);

    if (!workspace.hasRoadmap) {
      redirect(`/project/${id}`);
    }

    const milestone = workspace.milestones.find((item) => item.stepNumber === stepNumber);
    if (!milestone) {
      notFound();
    }

    const reviews = await listMilestoneReviews(milestone.id);

    return (
      <div className="space-y-8">
        <ProjectStepWorkspace workspace={workspace} milestone={milestone} plan={plan} />
        <ReviewerFeedbackPanel reviews={reviews} />
      </div>
    );
  } catch {
    notFound();
  }
}
