import { notFound } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectWorkspace } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { hasRoadmapDetailAccess } from "@/lib/usage/limits";
import { getPlanLabel, trackThemes } from "@/components/theme/theme-utils";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MilestoneChecklist } from "@/components/project/milestone-checklist";
import { GenerateRoadmapButton } from "@/components/project/generate-roadmap-button";

function totalEstimatedRange(milestones: Array<{ rough_time_estimate?: string | null }>) {
  if (milestones.length === 0) {
    return "No steps yet";
  }

  if (milestones.length <= 4) {
    return "Lean roadmap paced for momentum.";
  }

  return "Deeper roadmap paced one deliverable at a time.";
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();
  const { id } = await params;

  let workspace;
  try {
    workspace = await getProjectWorkspace(id, user.id);
  } catch {
    notFound();
  }

  const plan = await getUserPlan(user.id);
  const hasFullRoadmapAccess = hasRoadmapDetailAccess(plan);
  const projectTrack = workspace.project.project_track === "research" ? "research" : "software";
  const trackTheme = trackThemes[projectTrack];

  if (!workspace.roadmap) {
    return (
      <div className="space-y-8">
        <Card tone="contrast" className="border-contrast-line">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="contrast">{getPlanLabel(plan)}</Badge>
              <Badge tone={trackTheme.badgeTone}>{trackTheme.label}</Badge>
            </div>
            <PageHeader
              title={workspace.project.title}
              description={
                projectTrack === "research"
                  ? "Generate the roadmap overview first, then open each milestone when you want deeper research guidance."
                  : "Generate the roadmap overview first, then open each milestone when you want detailed build guidance."
              }
              className="text-paper [&_h1]:text-paper [&_p]:text-paper/72"
            />
            <GenerateRoadmapButton projectId={workspace.project.id} projectTrack={projectTrack} />
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <p className="editorial-kicker">What happens next</p>
            <p className="mt-3 text-lg font-semibold text-ink">Sevri creates the milestone structure.</p>
          </Card>
          <Card tone="primary">
            <p className="editorial-kicker">Execution bias</p>
            <p className="mt-3 text-lg font-semibold text-ink">You will move one deliverable at a time.</p>
          </Card>
          <Card tone="blush">
            <p className="editorial-kicker">Scope discipline</p>
            <p className="mt-3 text-lg font-semibold text-ink">The roadmap will keep the finishable version visible.</p>
          </Card>
        </div>
      </div>
    );
  }

  const milestones = workspace.milestones.map((milestone) => ({
    ...milestone,
    objective:
      typeof milestone.objective === "string" && milestone.objective.trim().length > 0
        ? milestone.objective
        : milestone.description,
    deliverable:
      typeof milestone.deliverable === "string" && milestone.deliverable.trim().length > 0
        ? milestone.deliverable
        : "Concrete step output",
    rough_time_estimate:
      typeof milestone.rough_time_estimate === "string" && milestone.rough_time_estimate.trim().length > 0
        ? milestone.rough_time_estimate
        : "About 1 week",
  }));

  const completedCount = milestones.filter((milestone) => milestone.completed).length;
  const completionPercent = milestones.length === 0 ? 0 : Math.round((completedCount / milestones.length) * 100);
  const stretchGoals = (Array.isArray(workspace.roadmap.stretch_goals) ? workspace.roadmap.stretch_goals : []).filter(
    (goal: unknown): goal is string => typeof goal === "string" && goal.trim().length > 0,
  );
  const roadmapPayload =
    workspace.roadmap.track_payload_json && typeof workspace.roadmap.track_payload_json === "object"
      ? (workspace.roadmap.track_payload_json as Record<string, unknown>)
      : {};
  const optionSeed =
    roadmapPayload.selected_option_seed && typeof roadmapPayload.selected_option_seed === "object"
      ? (roadmapPayload.selected_option_seed as Record<string, unknown>)
      : {};
  const projectBrief = getPayloadString(roadmapPayload.project_brief, "");
  const projectLens =
    projectTrack === "research"
      ? [
          { label: "Research question", value: getPayloadString(optionSeed.research_question, "Clarify the final question once the roadmap begins.") },
          { label: "Methodology", value: getPayloadString(optionSeed.methodology, "Choose the cleanest method that matches your access.") },
          { label: "Evidence plan", value: getPayloadString(optionSeed.evidence_plan, "Protect the evidence you can realistically gather.") },
        ]
      : [
          { label: "Target user", value: getPayloadString(optionSeed.target_user, "Clarify who this project is genuinely for.") },
          { label: "Problem statement", value: getPayloadString(optionSeed.problem_statement, "Keep the core problem concrete and narrow.") },
          { label: "Core workflow", value: getPayloadString(optionSeed.core_workflow, "Protect the first workflow that makes the project feel real.") },
        ];
  const keyDeliverables = milestones.slice(0, 3).map((milestone) => milestone.deliverable);

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
            title={workspace.project.title}
            description={workspace.roadmap.overview}
            className="text-paper [&_h1]:text-paper [&_p]:text-paper/72"
          />
          <ProgressBar
            value={completionPercent}
            label="Progress through the roadmap"
            helperText={`${completedCount} of ${milestones.length} milestones complete`}
            className="[&_.text-ink]:text-paper [&_.text-ink-muted]:text-paper/55"
          />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="editorial-kicker">Roadmap structure</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{milestones.length}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Milestones designed to keep momentum visible.</p>
        </Card>
        <Card tone="primary">
          <p className="editorial-kicker">Completed</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{completedCount}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">Every completed milestone protects the finishable version.</p>
        </Card>
        <Card tone="blush">
          <p className="editorial-kicker">Pacing</p>
          <p className="mt-3 text-lg font-semibold text-ink">{totalEstimatedRange(milestones)}</p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">One concrete deliverable per step, rather than vague phases.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card tone="primary" className="space-y-4">
          <p className="editorial-kicker">Stay finishable</p>
          <h2 className="text-3xl font-semibold text-ink">Protect the MVP scope before you chase the stretch version.</h2>
          <p className="text-sm leading-6 text-ink-soft">{workspace.roadmap.mvp_scope}</p>
          <div className="space-y-3">
            <p className="editorial-kicker">Key deliverables to protect</p>
            <ul className="space-y-2 text-sm leading-6 text-ink-soft">
              {keyDeliverables.map((deliverable) => (
                <li key={deliverable}>- {deliverable}</li>
              ))}
            </ul>
          </div>
          {stretchGoals.length ? (
            <div className="space-y-3">
              <p className="editorial-kicker">Stretch goals to delay</p>
              <ul className="space-y-2 text-sm leading-6 text-ink-soft">
                {stretchGoals.map((goal: string) => (
                  <li key={goal}>- {goal}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card className="space-y-4">
          <p className="editorial-kicker">Project lens</p>
          <h2 className="text-3xl font-semibold text-ink">
            {projectTrack === "research" ? "Keep the question and method visible." : "Keep the user and workflow visible."}
          </h2>
          {projectBrief ? (
            <div className="rounded-lg bg-canvas p-4">
              <p className="editorial-kicker">Project brief</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{projectBrief}</p>
            </div>
          ) : null}
          <div className="space-y-4">
            {projectLens.map((item) => (
              <div key={item.label} className="rounded-lg bg-canvas p-4">
                <p className="editorial-kicker">{item.label}</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{item.value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {hasFullRoadmapAccess ? (
        <MilestoneChecklist milestones={milestones} />
      ) : (
        <Card className="space-y-4">
          <div>
            <p className="editorial-kicker">Premium roadmap depth</p>
            <h2 className="mt-3 text-2xl font-semibold text-ink">Upgrade to unlock milestone guidance and work evaluation.</h2>
          </div>
          <p className="text-sm leading-6 text-ink-soft">
            Your roadmap overview stays visible on the free plan. Upgrade to Pro when you want step-by-step guidance, refreshable milestone coaching, and AI evaluation for submitted work.
          </p>
          <div>
            <Button href="/billing" className="rounded-full px-6">
              Upgrade to Pro
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function getPayloadString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}
