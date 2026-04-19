import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { GenerationFeedbackForm } from "@/components/shared/generation-feedback-form";
import { ReviewersCard } from "@/components/reviewer/reviewers-card";
import { getPlanLabel, trackThemes } from "@/components/theme/theme-utils";
import { safeRenderText } from "@/lib/ai/content-quality";
import {
  ROADMAP_OVERVIEW_PROSE_SPEC,
  ROADMAP_PROJECT_TITLE_SPEC,
} from "@/lib/ai/content-quality-specs";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";
import type {
  ProjectInvitationSummary,
  ProjectReviewerSummary,
} from "@/lib/db/queries/reviewers";
import type { Plan } from "@/types/domain";

function cleanOrUndefined(value: string | null | undefined, spec: typeof ROADMAP_OVERVIEW_PROSE_SPEC) {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const { text } = safeRenderText(value, spec);
  return text.length > 0 ? text : undefined;
}

function totalEstimatedRange(milestones: ProjectWorkspaceView["milestones"]) {
  if (milestones.length === 0) {
    return "No steps yet";
  }

  if (milestones.length <= 4) {
    return "Lean roadmap paced for momentum.";
  }

  return "Deeper roadmap paced one deliverable at a time.";
}

export function ProjectOverviewView({
  workspace,
  plan,
  reviewers,
  invitations,
}: {
  workspace: ProjectWorkspaceView;
  plan: Plan;
  reviewers: ProjectReviewerSummary[];
  invitations: ProjectInvitationSummary[];
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
      <Card tone="contrast" className="border-contrast-line">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="contrast">{getPlanLabel(plan)}</Badge>
            <Badge tone={trackTheme.badgeTone}>{trackTheme.label}</Badge>
            <Badge tone="contrast">{workspace.project.status}</Badge>
          </div>
          <PageHeader
            eyebrow="Project workspace"
            title={safeProjectTitle || workspace.project.title}
            description={safeOverview}
            actions={
              <Button href={nextStepHref} className="rounded-full px-6">
                {workspace.nextMilestone ? `Open Step ${workspace.nextMilestone.stepNumber}` : "Open project workspace"}
              </Button>
            }
            className="text-paper [&_.editorial-kicker]:text-paper/55 [&_h1]:text-paper [&_p]:text-paper/72"
          />
          <ProgressBar
            value={workspace.completionPercent}
            label="Progress through the roadmap"
            helperText={`${workspace.completedCount} of ${workspace.milestones.length} milestones complete`}
            className="[&_.text-ink]:text-paper [&_.text-ink-muted]:text-paper/55"
          />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="editorial-kicker">Roadmap structure</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{workspace.milestones.length}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Milestones designed to keep momentum visible.</p>
        </Card>
        <Card tone="primary">
          <p className="editorial-kicker">Completed</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{workspace.completedCount}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Every completed step protects the finishable version.</p>
        </Card>
        <Card tone="blush">
          <p className="editorial-kicker">Pacing</p>
          <p className="mt-3 text-lg font-semibold text-ink">{totalEstimatedRange(workspace.milestones)}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">One concrete deliverable per step, not a vague phase.</p>
        </Card>
      </div>

      <Card className="space-y-6">
        <div className="space-y-2">
          <p className="editorial-kicker">Project snapshot</p>
          <h2 className="text-2xl font-semibold text-ink">Keep the whole project legible at a glance.</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-2xl bg-canvas p-5">
            <p className="editorial-kicker">Overview</p>
            <p className="text-sm leading-6 text-ink-soft">{safeOverview}</p>
          </div>
          <div className="space-y-3 rounded-2xl bg-canvas p-5">
            <p className="editorial-kicker">Next move</p>
            <p className="text-sm leading-6 text-ink-soft">
              {workspace.nextMilestone
                ? `Focus on Step ${workspace.nextMilestone.stepNumber}: ${workspace.nextMilestone.title}. Keep the deliverable narrow before you move ahead.`
                : "Your roadmap is complete. Revisit scope guardrails before expanding the project."}
            </p>
          </div>
          <div className="space-y-3 rounded-2xl bg-canvas p-5">
            <p className="editorial-kicker">Protected deliverables</p>
            <ul className="space-y-2 text-sm leading-6 text-ink-soft">
              {workspace.keyDeliverables.map((deliverable) => (
                <li key={deliverable}>- {deliverable}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3 rounded-2xl bg-canvas p-5">
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
