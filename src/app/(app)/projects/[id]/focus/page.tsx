import { notFound } from "next/navigation";
import { FocusBlockClient } from "@/components/project/focus-block-client";
import { getRequiredStudentUser } from "@/lib/auth/guard";
import { getProjectScheduleGenerationContext } from "@/lib/db/queries/calendar";
import { getMilestoneGuidance } from "@/lib/db/queries/milestone-guidance";
import { getProjectWorkspaceView } from "@/lib/projects/workspace";

export default async function ProjectFocusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ session?: string; milestone?: string }>;
}) {
  const user = await getRequiredStudentUser();
  const { id: projectId } = await params;
  const query = await searchParams;

  try {
    const [workspace, schedule] = await Promise.all([
      getProjectWorkspaceView(projectId, user.id),
      getProjectScheduleGenerationContext(projectId, user.id),
    ]);
    const session = query.session
      ? schedule.workSessions.find((candidate) => candidate.id === query.session) ?? null
      : null;

    if (query.session && !session) {
      notFound();
    }

    const milestoneId = query.milestone ?? session?.milestoneId ?? workspace.nextMilestone?.id ?? null;
    const milestone = milestoneId
      ? workspace.milestones.find((candidate) => candidate.id === milestoneId) ?? null
      : null;

    if (!milestone) {
      notFound();
    }

    const guidance = await getMilestoneGuidance(milestone.id).catch(() => null);
    const task =
      session?.workDescription?.trim() ||
      workspace.nextStepAction?.nextChecklistItem?.trim() ||
      milestone.objective;
    const hint = guidance?.guidance.pitfalls[0]?.trim() || milestone.scopeGuardrail || null;

    return (
      <FocusBlockClient
        projectId={projectId}
        milestoneId={milestone.id}
        stepNumber={milestone.stepNumber}
        sessionId={session?.id ?? null}
        initialTask={task}
        hint={hint}
        triggerContext={session?.triggerContext?.trim() || null}
        durationMinutes={session?.durationMinutes ?? 25}
        scheduleTimezone={session?.scheduleTimezone ?? workspace.scheduleTimezone}
      />
    );
  } catch {
    notFound();
  }
}
