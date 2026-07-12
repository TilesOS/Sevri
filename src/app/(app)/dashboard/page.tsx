import type { ReactNode } from "react";
import { ArrowRight, Code2, FileText, Lightbulb, Plus } from "lucide-react";
import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectsForDashboard } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getRecommendationGenerationCount, getTrackAvailability } from "@/lib/db/queries/recommendations";
import { PLAN_LIMITS } from "@/lib/usage/limits";
import { getPlanLabel, getTrackLabel, trackThemes } from "@/components/theme/theme-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProjectProgressTracker } from "@/components/project/project-progress-tracker";

export default async function DashboardPage() {
  const user = await getRequiredUser();
  const [projects, plan, recommendationGenerations, trackAvailability] = await Promise.all([
    getProjectsForDashboard(user.id),
    getUserPlan(user.id),
    getRecommendationGenerationCount(user.id),
    getTrackAvailability(user.id),
  ]);

  const outputTotals = projects.reduce(
    (totals, project) => {
      if (project.project_track === "research") totals.researchWords += project.outputMetrics.wordCount;
      else totals.softwareCommits += project.outputMetrics.commitCount;
      return totals;
    },
    { softwareCommits: 0, researchWords: 0 },
  );
  const activeProject = projects.find((project) => project.status === "active" || project.status === "paused") ?? projects[0] ?? null;
  const nextAction = activeProject
    ? { href: `/project/${activeProject.id}`, label: activeProject.hasRoadmap ? "Continue project" : "Generate roadmap" }
    : trackAvailability.software.hasIntake || trackAvailability.research.hasIntake
      ? { href: `/recommendations?track=${trackAvailability.software.hasIntake ? "software" : "research"}`, label: "Explore ideas" }
      : { href: "/onboarding", label: "Start onboarding" };

  const planDetail = plan === "pro_monthly"
    ? "Unlimited idea generations with Pro coaching, subject to fair-use limits."
    : `${PLAN_LIMITS.free.generation_limit} free idea generations plus roadmap access.`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Dashboard"
        description="Pick up the work that matters, or shape a new direction."
        actions={<Button href="/recommendations" leadingIcon={<Plus className="h-4 w-4" />}>New idea</Button>}
      />

      <Card padding="lg" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-ink-muted">{activeProject ? "Continue where you left off" : "Set your direction"}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
            {activeProject ? activeProject.title : "Choose a project worth finishing."}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            {activeProject
              ? activeProject.hasRoadmap
                ? "Your next milestone is ready. Keep the finishable version moving."
                : "Turn the direction you chose into a concrete roadmap."
              : "Use onboarding and the idea board to compare focused software and research directions."}
          </p>
          {activeProject ? <ProjectProgressTracker progress={activeProject.progress} compact className="mt-5 max-w-xl" /> : null}
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          <Button href={nextAction.href} trailingIcon={<ArrowRight className="h-4 w-4" />}>{nextAction.label}</Button>
          <Button href="/recommendations" variant="outline">View ideas</Button>
        </div>
      </Card>

      <section aria-labelledby="workspace-summary-title">
        <h2 id="workspace-summary-title" className="sr-only">Workspace summary</h2>
        <div className="grid overflow-hidden rounded-xl border border-line bg-paper sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Plan" value={getPlanLabel(plan)} detail={planDetail} />
          <Metric label="Ideas used" value={formatMetricNumber(recommendationGenerations)} detail="Across both tracks" />
          <Metric label="Projects" value={formatMetricNumber(projects.length)} detail="Saved work" />
          <Metric label="Commits" value={formatMetricNumber(outputTotals.softwareCommits)} detail="Software projects" icon={<Code2 className="h-4 w-4" />} />
          <Metric label="Words" value={formatMetricNumber(outputTotals.researchWords)} detail="Research drafts" icon={<FileText className="h-4 w-4" />} />
        </div>
      </section>

      <ProjectsSection
        projects={projects}
        trackAvailability={trackAvailability}
      />
    </div>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: ReactNode }) {
  return (
    <div className="border-b border-line p-4 last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">{icon}{label}</div>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted" title={detail}>{detail}</p>
    </div>
  );
}

type DashboardProject = Awaited<ReturnType<typeof getProjectsForDashboard>>[number];

function ProjectsSection({
  projects,
  trackAvailability,
}: {
  projects: DashboardProject[];
  trackAvailability: {
    software: { hasIntake: boolean; recommendationCount: number };
    research: { hasIntake: boolean; recommendationCount: number };
  };
}) {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Projects</h2>
          <p className="mt-1 text-sm text-ink-muted">Software and research work in one place.</p>
        </div>
        <Button href="/recommendations" variant="outline" size="sm" leadingIcon={<Lightbulb className="h-4 w-4" />}>Browse ideas</Button>
      </div>
      {projects.length ? (
        <div className="divide-y divide-line">
          {projects.map((project) => {
            const track = project.project_track === "research" ? "research" : "software";
            const trackTheme = trackThemes[track];
            return (
              <div key={project.id} className="grid gap-4 px-5 py-4 transition-colors hover:bg-surface/60 md:grid-cols-[minmax(0,1fr)_minmax(12rem,18rem)_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-ink">{project.title}</h3>
                    <Badge tone={trackTheme.badgeTone}>{getTrackLabel(track)}</Badge>
                    <Badge tone={project.status === "completed" ? "success" : "neutral"}>{project.progress.stageLabel}</Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-ink-muted">{project.progress.stageDetail}</p>
                </div>
                <ProjectProgressTracker progress={project.progress} compact />
                <Button href={`/project/${project.id}`} variant="ghost" size="sm" trailingIcon={<ArrowRight className="h-4 w-4" />}>Open</Button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {(["software", "research"] as const).map((track) => {
            const availability = trackAvailability[track];
            return (
              <div key={track} className="rounded-lg bg-surface p-4">
                <h3 className="text-sm font-medium text-ink">{getTrackLabel(track)}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  {availability.hasIntake
                    ? `${availability.recommendationCount} saved directions. Generate an idea board and choose the strongest one.`
                    : `Complete ${track} onboarding to start this track.`}
                </p>
                <Button href={availability.hasIntake ? `/recommendations?track=${track}` : "/onboarding"} variant="outline" size="sm" className="mt-4">
                  {availability.hasIntake ? "Open ideas" : "Complete onboarding"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function formatMetricNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
