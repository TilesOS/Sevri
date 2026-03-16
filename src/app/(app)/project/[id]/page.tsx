import { notFound } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectWorkspace } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MilestoneChecklist } from "@/components/project/milestone-checklist";
import { GenerateRoadmapButton } from "@/components/project/generate-roadmap-button";

function totalEstimatedRange(milestones: Array<{ rough_time_estimate?: string | null }>) {
  if (milestones.length === 0) {
    return "No steps yet";
  }

  return `${milestones.length} steps`;
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
  const projectTrack = workspace.project.project_track === "research" ? "research" : "software";

  if (!workspace.roadmap) {
    return (
      <div className="space-y-6">
        <Card className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
            <Badge className={projectTrack === "research" ? "bg-sky-500/15 text-sky-400" : ""}>
              {projectTrack === "research" ? "Research" : "Software"}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-ink-900">{workspace.project.title}</h1>
          <p className="text-sm text-ink-700">
            {projectTrack === "research"
              ? "Generate the roadmap overview first, then open each step when you want deeper guidance."
              : "Generate the roadmap overview first, then open each step when you want detailed build guidance."}
          </p>
          <GenerateRoadmapButton projectId={workspace.project.id} projectTrack={projectTrack} />
        </Card>
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

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
          <Badge className={projectTrack === "research" ? "bg-sky-500/15 text-sky-400" : ""}>
            {projectTrack === "research" ? "Research" : "Software"}
          </Badge>
          <Badge className="bg-mint-100 text-mint-700">{workspace.project.status}</Badge>
        </div>
        <h1 className="text-2xl font-bold text-ink-900">{workspace.project.title}</h1>
        <p className="max-w-3xl text-sm text-ink-700">{workspace.roadmap.overview}</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">Overview</p>
          <p className="text-sm text-ink-700">
            {projectTrack === "research"
              ? "This roadmap stays intentionally light so you can start moving now and open detail only when you need it."
              : "This roadmap is built for fast execution: choose the next step, open its guidance, and keep momentum."}
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">Progress</p>
          <p className="text-sm text-ink-700">
            {completedCount} of {milestones.length} steps completed
          </p>
        </Card>
        <Card className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">Pacing</p>
          <p className="text-sm text-ink-700">{totalEstimatedRange(milestones)}</p>
        </Card>
      </div>

      <MilestoneChecklist milestones={milestones} />
    </div>
  );
}
