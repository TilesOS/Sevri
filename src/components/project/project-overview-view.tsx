import { CalendarScheduleRetryButton } from "@/components/calendar/calendar-schedule-retry-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { GenerationFeedbackForm } from "@/components/shared/generation-feedback-form";
import { ReviewersCard } from "@/components/reviewer/reviewers-card";
import { GithubOverviewCard } from "@/components/project/github-overview-card";
import { getPlanLabel, trackThemes } from "@/components/theme/theme-utils";
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
  const trackTheme = trackThemes[workspace.projectTrack];
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
              <Button href="/calendar" variant="outline" className="rounded-full">
                Open calendar
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      {/* Page heading */}
      <div>
        <div className="kicker" style={{ marginBottom: 10 }}>
          <span className="star">✦</span>
          <span style={{ color: 'var(--ink-muted)' }}>~ active project ~</span>
        </div>
        <h1 className="display" style={{ margin: 0, maxWidth: 900, fontSize: 'clamp(40px, 5vw, 72px)' }}>
          <span className="hl-yellow">{safeProjectTitle || workspace.project.title}</span>
        </h1>
        {safeOverview ? (
          <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-soft)', marginTop: 12, maxWidth: 680, lineHeight: 1.6 }}>
            {safeOverview}
          </p>
        ) : null}
      </div>

      {/* Hero coach card with progress */}
      <div className="coach" style={{ marginTop: 16, boxShadow: '6px 6px 0 var(--pink)' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
              <Badge tone="contrast">{getPlanLabel(plan)}</Badge>
              <Badge tone={trackTheme.badgeTone}>{trackTheme.label}</Badge>
              <Badge tone="contrast">{workspace.project.status}</Badge>
            </div>
            <Button href={nextStepHref} className="shrink-0">
              {workspace.nextMilestone ? `Open Step ${workspace.nextMilestone.stepNumber}` : "Open project workspace"}
            </Button>
          </div>

          <NextActionPanel action={workspace.nextStepAction} />

          <ProgressBar
            value={workspace.completionPercent}
            label="Progress through the roadmap"
            helperText={`${workspace.completedCount} of ${workspace.milestones.length} milestones complete`}
            className="[&_.text-ink]:text-paper [&_.text-ink-muted]:text-paper/55"
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card style={{ borderColor: 'var(--ink)', boxShadow: '3px 3px 0 var(--yellow)', backgroundColor: 'rgba(255,217,61,0.08)' }}>
          <p className="editorial-kicker">Roadmap structure</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{workspace.milestones.length}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Milestones designed to keep momentum visible.</p>
        </Card>
        <Card style={{ borderColor: 'var(--ink)', boxShadow: '3px 3px 0 var(--cyan)', backgroundColor: 'rgba(91,208,214,0.08)' }}>
          <p className="editorial-kicker">Completed</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{workspace.completedCount}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Every completed step protects the finishable version.</p>
        </Card>
        <Card style={{ borderColor: 'var(--ink)', boxShadow: '3px 3px 0 var(--pink)', backgroundColor: 'rgba(255,77,166,0.06)' }}>
          <p className="editorial-kicker">Pacing</p>
          <p className="mt-3 text-lg font-semibold text-ink">{totalEstimatedRange(workspace.milestones)}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">One concrete deliverable per step, not a vague phase.</p>
        </Card>
      </div>

      {workspace.projectTrack === "software" ? (
        <GithubOverviewCard
          projectId={workspace.project.id}
          plan={plan}
          integration={githubIntegration}
          link={workspace.githubLink}
        />
      ) : null}

      {/* Project snapshot */}
      <Card className="space-y-6">
        <div className="space-y-2">
          <p className="editorial-kicker">Project snapshot</p>
          <h2 className="text-2xl font-semibold text-ink">Keep the whole project legible at a glance.</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-md bg-canvas p-5" style={{ border: '2px solid var(--ink)', borderTop: '4px solid var(--yellow)' }}>
            <p className="editorial-kicker">Overview</p>
            <p className="text-sm leading-6 text-ink-soft">{safeOverview}</p>
          </div>
          <div className="space-y-3 rounded-md bg-canvas p-5" style={{ border: '2px solid var(--ink)', borderTop: '4px solid var(--cyan)' }}>
            <p className="editorial-kicker">Next move</p>
            <p className="text-sm leading-6 text-ink-soft">
              {workspace.nextMilestone
                ? `Focus on Step ${workspace.nextMilestone.stepNumber}: ${workspace.nextMilestone.title}. Keep the deliverable narrow before you move ahead.`
                : "Your roadmap is complete. Revisit scope guardrails before expanding the project."}
            </p>
          </div>
          <div className="space-y-3 rounded-md bg-canvas p-5" style={{ border: '2px solid var(--ink)', borderTop: '4px solid var(--pink)' }}>
            <p className="editorial-kicker">Protected deliverables</p>
            <ul className="space-y-2 text-sm leading-6 text-ink-soft">
              {workspace.keyDeliverables.map((deliverable) => (
                <li key={deliverable}>— {deliverable}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3 rounded-md bg-canvas p-5" style={{ border: '2px solid var(--ink)', borderTop: '4px solid var(--green)' }}>
            <p className="editorial-kicker">Project lens</p>
            <p className="text-sm leading-6 text-ink-soft">
              {workspace.projectLens.map((item) => item.label).join(" · ")}
            </p>
            <p className="text-sm leading-6 text-ink-soft">
              {safeProjectBrief || "The research lens page keeps the framing and context visible while you build."}
            </p>
          </div>
        </div>
      </Card>

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

function NextActionPanel({ action }: { action: NextStepActionPreview | null }) {
  if (!action) {
    return (
      <div
        style={{
          marginBottom: 24,
          padding: '16px 18px',
          borderRadius: 12,
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <p className="editorial-kicker" style={{ color: 'rgba(251, 246, 233, 0.55)' }}>
          Roadmap complete
        </p>
        <p style={{ marginTop: 8, color: 'rgba(251, 246, 233, 0.85)', fontSize: 15, lineHeight: 1.55 }}>
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
    <div
      style={{
        marginBottom: 24,
        padding: '18px 20px',
        borderRadius: 12,
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderLeft: '3px solid var(--cyan)',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <p className="editorial-kicker" style={{ color: 'rgba(251, 246, 233, 0.55)', margin: 0 }}>
          Picking up at Step {action.stepNumber}
        </p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(251, 246, 233, 0.55)', margin: 0 }}>
          {progressLabel}
        </p>
      </div>

      <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(251, 246, 233, 0.6)', margin: 0 }}>
        Step goal
      </p>
      <p style={{ marginTop: 4, color: 'rgba(251, 246, 233, 0.85)', fontSize: 14, lineHeight: 1.55 }}>
        {goal}
      </p>

      <p style={{ marginTop: 14, fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(251, 246, 233, 0.6)', margin: '14px 0 0' }}>
        Next up
      </p>
      <p style={{ marginTop: 4, color: 'var(--paper)', fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
        {nextLine}
      </p>
    </div>
  );
}
