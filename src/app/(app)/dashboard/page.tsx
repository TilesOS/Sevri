import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ArrowRight, Code2, FileText, Lightbulb, Sparkles } from "lucide-react";
import { getRequiredUser } from "@/lib/auth/guard";
import { resolveDisplayName } from "@/lib/auth/names";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getArchivedProjectsForDashboard, getProjectsForDashboard } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getRecommendationGenerationCount, getTrackAvailability } from "@/lib/db/queries/recommendations";
import { PLAN_LIMITS } from "@/lib/usage/limits";
import { getPlanLabel, getTrackLabel, trackThemes } from "@/components/theme/theme-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ProjectProgressTracker } from "@/components/project/project-progress-tracker";
import { ProjectArchiveActions } from "@/components/project/project-archive-actions";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();
  const [projects, archivedProjects, plan, recommendationGenerations, trackAvailability, { data: profile }] = await Promise.all([
    getProjectsForDashboard(user.id),
    getArchivedProjectsForDashboard(user.id),
    getUserPlan(user.id),
    getRecommendationGenerationCount(user.id),
    getTrackAvailability(user.id),
    supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
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
  const displayName = resolveDisplayName({
    profileFullName: profile?.full_name,
    userMetadata: user.user_metadata,
    email: user.email,
  });
  const firstName = displayName.split(/\s+/).filter(Boolean)[0] ?? "there";
  const completedProjects = projects.filter((project) => project.status === "completed").length;
  const averageProgress = projects.length
    ? Math.round(projects.reduce((total, project) => total + project.progress.percent, 0) / projects.length)
    : 0;
  const nextAction = activeProject
    ? {
        href: activeProject.hasRoadmap && activeProject.currentStepNumber
          ? `/project/${activeProject.id}/steps/${activeProject.currentStepNumber}`
          : `/project/${activeProject.id}`,
        label: activeProject.hasRoadmap ? "Continue project" : "Generate roadmap",
      }
    : trackAvailability.software.hasIntake || trackAvailability.research.hasIntake
      ? { href: `/recommendations?track=${trackAvailability.software.hasIntake ? "software" : "research"}`, label: "Explore ideas" }
      : { href: "/onboarding", label: "Start onboarding" };

  const planDetail = plan === "pro_monthly"
    ? "Unlimited idea generations with Pro coaching, subject to fair-use limits."
    : `${PLAN_LIMITS.free.generation_limit} free idea generations plus roadmap access.`;

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        eyebrow={`Welcome back, ${firstName}`}
        title="Keep the next finishable step moving."
        description="Your active work, visible momentum, and next action—without the project-management noise."
        metadata={
          <>
            <Badge tone="neutral">{getPlanLabel(plan)}</Badge>
            <span>{projects.length ? `${projects.length} saved ${projects.length === 1 ? "project" : "projects"}` : "Your workspace is ready"}</span>
          </>
        }
        actions={
          <Button href={nextAction.href} trailingIcon={<ArrowRight className="h-4 w-4" />}>
            {activeProject?.hasRoadmap ? "Go to current step" : nextAction.label}
          </Button>
        }
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.65fr)]">
        <div className="relative isolate overflow-hidden rounded-3xl bg-navy px-6 py-7 text-cream shadow-soft sm:px-8 sm:py-8">
          <div className="aurora-fallback pointer-events-none absolute inset-0 -z-10 opacity-35" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-cream/15 bg-cream/[0.07] px-3 py-1 text-[11px] font-semibold text-cream/75 backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-teal" aria-hidden="true" />
              {activeProject ? "Continue where you left off" : "Your next project starts here"}
            </span>
            {activeProject ? (
              <span className="rounded-full border border-cream/15 bg-cream/[0.05] px-3 py-1 text-[11px] font-medium text-cream/65">
                {activeProject.progress.stageLabel}
              </span>
            ) : null}
          </div>

          <h2 className="mt-5 max-w-3xl font-display text-3xl leading-tight tracking-tight text-cream sm:text-4xl">
            {activeProject ? activeProject.title : "Choose a direction worth finishing."}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/70 sm:text-[15px]">
            {activeProject
              ? activeProject.hasRoadmap
                ? activeProject.progress.stageDetail
                : "Turn the direction you chose into a concrete, finishable roadmap."
              : "Compare focused software and research directions, then commit to the one that fits your real time and interests."}
          </p>

          {activeProject ? (
            <ProjectProgressTracker progress={activeProject.progress} compact contrast className="mt-6 max-w-3xl" />
          ) : null}

          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button href={nextAction.href} variant="contrast" trailingIcon={<ArrowRight className="h-4 w-4" />}>{nextAction.label}</Button>
            <Button
              href="/recommendations"
              variant="outline"
              className="border-cream/15 bg-cream/[0.06] text-cream shadow-none hover:border-cream/25 hover:bg-cream/[0.11]"
            >
              Compare ideas
            </Button>
          </div>
        </div>

        <Card tone="butter" padding="lg" elevation="soft" className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="editorial-kicker">Momentum</p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-ink">A quick read on your work.</h2>
            </div>
            <Badge tone={plan === "pro_monthly" ? "accent" : "neutral"}>{getPlanLabel(plan)}</Badge>
          </div>
          <div className="mt-6 grid flex-1 grid-cols-2 gap-px overflow-hidden rounded-xl bg-line/80">
            <Metric label="Average progress" value={`${averageProgress}%`} detail="Across saved projects" />
            <Metric label="Completed" value={formatMetricNumber(completedProjects)} detail="Projects shipped" />
            <Metric label="Commits" value={formatMetricNumber(outputTotals.softwareCommits)} detail="Software proof" icon={<Code2 className="h-3.5 w-3.5" />} />
            <Metric label="Words" value={formatMetricNumber(outputTotals.researchWords)} detail="Research proof" icon={<FileText className="h-3.5 w-3.5" />} />
          </div>
          <p className="mt-4 text-xs leading-5 text-ink-muted">
            {planDetail} {recommendationGenerations ? `${recommendationGenerations} idea ${recommendationGenerations === 1 ? "board" : "boards"} generated so far.` : ""}
          </p>
        </Card>
      </section>

      <ProjectsSection
        projects={projects}
        archivedProjects={archivedProjects}
        trackAvailability={trackAvailability}
      />
    </div>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail: string; icon?: ReactNode }) {
  return (
    <div className="bg-paper/90 p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium text-ink-muted">{icon}{label}</div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-ink-muted" title={detail}>{detail}</p>
    </div>
  );
}

type DashboardProject = Awaited<ReturnType<typeof getProjectsForDashboard>>[number];
type ArchivedProject = Awaited<ReturnType<typeof getArchivedProjectsForDashboard>>[number];

function ProjectsSection({
  projects,
  archivedProjects,
  trackAvailability,
}: {
  projects: DashboardProject[];
  archivedProjects: ArchivedProject[];
  trackAvailability: {
    software: { hasIntake: boolean; recommendationCount: number };
    research: { hasIntake: boolean; recommendationCount: number };
  };
}) {
  return (
    <Card padding="none" elevation="soft" className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/80 px-5 py-5 sm:px-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Your projects</h2>
          <p className="mt-1 text-sm text-ink-muted">Every active direction, with the next move visible.</p>
        </div>
        <Button href="/recommendations" variant="outline" size="sm" leadingIcon={<Lightbulb className="h-4 w-4" />}>Browse ideas</Button>
      </div>
      {projects.length ? (
        <div className="divide-y divide-line/75">
          {projects.map((project) => {
            const track = project.project_track === "research" ? "research" : "software";
            const trackTheme = trackThemes[track];
            return (
              <div key={project.id} className="group grid gap-4 px-5 py-4 transition-colors duration-150 hover:bg-surface/45 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(12rem,17rem)_auto] md:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${trackTheme.accentSurfaceClassName} ${trackTheme.iconClassName}`}>
                    {track === "software" ? <Code2 className="h-4 w-4" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-ink">{project.title}</h3>
                    <Badge tone={trackTheme.badgeTone}>{getTrackLabel(track)}</Badge>
                  </div>
                    <p className="mt-1 line-clamp-1 text-xs text-ink-muted">{project.progress.stageDetail}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium text-ink-soft">{project.progress.stageLabel}</span>
                    <span className="shrink-0 tabular-nums text-ink-muted">{project.progress.percent}%</span>
                  </div>
                  <ProgressBar value={project.progress.percent} ariaLabel={`${project.title} progress`} />
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button href={`/project/${project.id}`} variant="ghost" size="sm" trailingIcon={<ArrowRight className="h-4 w-4" />}>Open</Button>
                  <ProjectArchiveActions projectId={project.id} projectTitle={project.title} archived={false} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
          {(["software", "research"] as const).map((track) => {
            const availability = trackAvailability[track];
            const trackTheme = trackThemes[track];
            return (
              <div
                key={track}
                className={`rounded-2xl p-5 ${trackTheme.accentSurfaceClassName}`}
              >
                <span className={`grid h-9 w-9 place-items-center rounded-xl bg-paper/75 ${trackTheme.iconClassName}`}>
                  {track === "software" ? <Code2 className="h-4 w-4" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                </span>
                <h3 className="mt-4 text-base font-semibold text-ink">{getTrackLabel(track)}</h3>
                <p className="mt-1 text-sm leading-6 text-ink-soft">
                  {availability.hasIntake
                    ? `${availability.recommendationCount} saved directions. Generate an idea board and choose the strongest one.`
                    : `Complete ${track} onboarding to start this track.`}
                </p>
                <Button href={availability.hasIntake ? `/recommendations?track=${track}` : "/onboarding"} variant="outline" size="sm" className="mt-4" trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}>
                  {availability.hasIntake ? "Open ideas" : "Complete onboarding"}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {archivedProjects.length ? (
        <details className="group border-t border-line/80">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-semibold text-ink-soft hover:text-ink sm:px-6 [&::-webkit-details-marker]:hidden">
            <span>
              Archived ({archivedProjects.length}) — hidden from your dashboard and calendar, nothing deleted
            </span>
            <span aria-hidden="true" className="text-xs text-ink-muted transition group-open:rotate-180">▾</span>
          </summary>
          <div className="divide-y divide-line/75 border-t border-line/80">
            {archivedProjects.map((project) => {
              const track = project.project_track === "research" ? "research" : "software";
              return (
                <div
                  key={project.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-sm font-medium text-ink-soft">{project.title}</span>
                    <Badge tone="neutral">{getTrackLabel(track)}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button href={`/project/${project.id}`} variant="ghost" size="sm">Open</Button>
                    <ProjectArchiveActions
                      projectId={project.id}
                      projectTitle={project.title}
                      archived
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </Card>
  );
}

function formatMetricNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
