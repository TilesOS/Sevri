import { CalendarScheduleRetryButton } from "@/components/calendar/calendar-schedule-retry-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DescriptionList } from "@/components/ui/description-list";
import { PageHeader } from "@/components/ui/page-header";
import { GenerationFeedbackForm } from "@/components/shared/generation-feedback-form";
import { ReviewersCard } from "@/components/reviewer/reviewers-card";
import { GithubOverviewCard } from "@/components/project/github-overview-card";
import { ProjectProgressTracker } from "@/components/project/project-progress-tracker";
import { LearningResourcesPreview } from "@/components/project/project-learning-resources-view";
import { getPlanLabel } from "@/components/theme/theme-utils";
import { safeRenderText } from "@/lib/ai/content-quality";
import {
  GUIDANCE_WHAT_TO_DO_SPEC,
  ROADMAP_OVERVIEW_PROSE_SPEC,
  ROADMAP_PROJECT_TITLE_SPEC,
  STEP_OBJECTIVE_SPEC,
} from "@/lib/ai/content-quality-specs";
import type { NextStepActionPreview, ProjectWorkspaceView } from "@/lib/projects/workspace";
import type {
  ProjectInvitationSummary,
  ProjectReviewerSummary,
} from "@/lib/db/queries/reviewers";
import type { UserIntegrationPublicRow } from "@/lib/db/queries/github";
import type { Plan } from "@/types/domain";

function cleanOrUndefined(value: string | null | undefined, spec: typeof ROADMAP_OVERVIEW_PROSE_SPEC) {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const { text } = safeRenderText(value, spec);
  return text.length > 0 ? text : undefined;
}

function totalEstimatedRange(milestones: ProjectWorkspaceView["milestones"]) {
  if (milestones.length === 0) return "No steps yet";
  if (milestones.length <= 4) return "Lean roadmap paced for momentum.";
  return "Deeper roadmap paced one deliverable at a time.";
}

export function ProjectOverviewView({
  workspace,
  plan,
  reviewers,
  invitations,
  githubIntegration,
  showScheduleRetryNotice = false,
}: {
  workspace: ProjectWorkspaceView;
  plan: Plan;
  reviewers: ProjectReviewerSummary[];
  invitations: ProjectInvitationSummary[];
  githubIntegration: UserIntegrationPublicRow | null;
  showScheduleRetryNotice?: boolean;
}) {
  const nextStepHref = workspace.nextMilestone
    ? `/project/${workspace.project.id}/steps/${workspace.nextMilestone.stepNumber}`
    : `/project/${workspace.project.id}/scope`;
  const safeProjectTitle = safeRenderText(workspace.project.title ?? "", ROADMAP_PROJECT_TITLE_SPEC).text;
  const safeOverview = cleanOrUndefined(workspace.roadmap?.overview, ROADMAP_OVERVIEW_PROSE_SPEC);
  const safeProjectBrief = cleanOrUndefined(workspace.projectBrief, ROADMAP_OVERVIEW_PROSE_SPEC);

  return (
    <div className="space-y-8">
      {showScheduleRetryNotice ? (
        <Alert tone="warning" heading="Roadmap saved, but the schedule needs another try.">
          <div className="space-y-3">
            <p>The roadmap is ready. Calendar dates were not created on the first pass, so due dates may be missing until the schedule is rebuilt.</p>
            <div className="flex flex-wrap gap-3">
              <CalendarScheduleRetryButton projectId={workspace.project.id} className="rounded-full" />
              <Button href="/calendar" variant="outline">
                Open calendar
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      <PageHeader
        eyebrow="Active project"
        title={safeProjectTitle || workspace.project.title}
        description={safeOverview}
        metadata={
          <>
            <Badge tone="neutral">{workspace.projectKindLabel}</Badge>
            <Badge tone="neutral">{workspace.project.status}</Badge>
            <span>{getPlanLabel(plan)}</span>
          </>
        }
        actions={<Button href={nextStepHref}>{workspace.nextMilestone ? `Open Step ${workspace.nextMilestone.stepNumber}` : "Open workspace"}</Button>}
      />

      {/* Hero coach card with progress */}
      <Card padding="lg" className="space-y-5">
          <div>
            <p className="text-xs font-medium text-ink-muted">Next action</p>
          <NextActionPanel action={workspace.nextStepAction} />
          </div>
          <ProjectProgressTracker progress={workspace.progress} />
      </Card>

      {/* Stat cards */}
      <div className="grid overflow-hidden rounded-xl border border-line bg-paper md:grid-cols-3">
        <ProjectMetric label="Roadmap" value={`${workspace.milestones.length} steps`} detail="Designed to keep momentum visible." />
        <ProjectMetric label="Completed" value={`${workspace.completedCount}`} detail="Every completed step protects the finishable version." />
        <ProjectMetric label="Pacing" value={totalEstimatedRange(workspace.milestones)} detail="One concrete deliverable per step." />
      </div>

      <GithubOverviewCard
          projectId={workspace.project.id}
          plan={plan}
          integration={githubIntegration}
          link={workspace.githubLink}
        />

      {/* Project snapshot */}
      <Card className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">Project snapshot</h2>
          <p className="text-sm text-ink-muted">Keep the whole project legible at a glance.</p>
        </div>
        <DescriptionList items={[
          { label: "Overview", value: safeOverview || "No overview yet." },
          { label: "Next move", value: workspace.nextMilestone ? `Focus on Step ${workspace.nextMilestone.stepNumber}: ${workspace.nextMilestone.title}. Keep the deliverable narrow before you move ahead.` : "Your roadmap is complete. Revisit scope guardrails before expanding the project." },
          { label: "Protected deliverables", value: <ul className="space-y-1">{workspace.keyDeliverables.map((deliverable) => <li key={deliverable}>• {deliverable}</li>)}</ul> },
          {
            label: "Your project lens",
            value: (
              <div className="space-y-1">
                <p>{workspace.projectLens.map((item) => item.label).join(" · ")}</p>
                <p className="text-ink-soft">
                  {safeProjectBrief || "Your lens keeps the problem and the audience visible while you build."}
                </p>
              </div>
            ),
          },
        ]} />
      </Card>

      <LearningResourcesPreview workspace={workspace} />

      <ReviewersCard
        projectId={workspace.project.id}
        plan={plan}
        reviewers={reviewers}
        invitations={invitations}
      />

      {workspace.roadmap ? (
        <GenerationFeedbackForm
          variant="compact"
          stage="roadmap"
          roadmapId={workspace.roadmap.id}
          title="How is the roadmap landing?"
          description="Optional. Share what feels sharp, too generic, or too ambitious."
        />
      ) : null}
    </div>
  );
}

function ProjectMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-b border-line p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="mt-2 text-base font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs leading-5 text-ink-muted">{detail}</p>
    </div>
  );
}

function NextActionPanel({ action }: { action: NextStepActionPreview | null }) {
  if (!action) {
    return (
      <div className="mt-3 rounded-lg bg-surface p-4">
        <p className="text-sm font-medium text-ink">Roadmap complete</p>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Every step is marked done. Revisit scope before expanding the project, or jump back into a step to polish it.
        </p>
      </div>
    );
  }

  const goal = safeRenderText(action.stepObjective, STEP_OBJECTIVE_SPEC).text;
  const nextItem = action.nextChecklistItem
    ? safeRenderText(action.nextChecklistItem, GUIDANCE_WHAT_TO_DO_SPEC).text
    : null;

  let nextLine: string;
  if (action.guidanceMissing) {
    nextLine = "Open this step to load its checklist and see your next concrete action.";
  } else if (action.allChecked) {
    nextLine = "Every checklist item is done — submit your work for evaluation or mark the step complete.";
  } else if (nextItem) {
    nextLine = nextItem;
  } else {
    nextLine = "Open this step to pick up your next action.";
  }

  const progressLabel =
    action.totalChecklistItems > 0
      ? `${action.checkedCount} of ${action.totalChecklistItems} checklist items done`
      : "Checklist not loaded yet";

  return (
    <div className="mt-3 rounded-lg border border-primary-line bg-primary-soft/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Picking up at Step {action.stepNumber}</p>
        <p className="text-xs text-ink-muted">{progressLabel}</p>
      </div>

      <p className="text-xs font-medium text-ink-muted">Step goal</p>
      <p className="mt-1 text-sm leading-6 text-ink-soft">{goal}</p>

      <p className="mt-4 text-xs font-medium text-ink-muted">Next up</p>
      <p className="mt-1 text-sm font-medium leading-6 text-ink">{nextLine}</p>
    </div>
  );
}
