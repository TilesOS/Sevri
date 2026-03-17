import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectsForDashboard } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getRecommendationGenerationCount, getTrackAvailability } from "@/lib/db/queries/recommendations";
import { getPlanLabel, getTrackLabel, trackThemes } from "@/components/theme/theme-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default async function DashboardPage() {
  const user = await getRequiredUser();
  const [projects, plan, recommendationBatches, trackAvailability] = await Promise.all([
    getProjectsForDashboard(user.id),
    getUserPlan(user.id),
    getRecommendationGenerationCount(user.id),
    getTrackAvailability(user.id),
  ]);

  const softwareProjects = projects.filter((project) => project.project_track === "software");
  const researchProjects = projects.filter((project) => project.project_track === "research");
  const activeProject =
    projects.find((project) => project.status === "active" || project.status === "paused") ?? projects[0] ?? null;

  const nextAction = activeProject
    ? {
        href: `/project/${activeProject.id}`,
        label: activeProject.hasRoadmap ? "Open active workspace" : "Generate roadmap",
      }
    : trackAvailability.software.hasIntake || trackAvailability.research.hasIntake
      ? {
          href: `/recommendations?track=${trackAvailability.software.hasIntake ? "software" : "research"}`,
          label: "Open recommendation board",
        }
      : {
          href: "/onboarding",
          label: "Start onboarding",
        };

  return (
    <div className="space-y-8">
      <Card tone="contrast" className="border-contrast-line">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <PageHeader
              eyebrow="Continue your journey"
              title={activeProject ? activeProject.title : "Set the direction worth finishing."}
              description={
                activeProject
                  ? activeProject.hasRoadmap
                    ? "Your workspace is ready. Keep the next milestone moving and protect the finishable version of the project."
                    : "You have already chosen a direction. The next move is to turn it into a roadmap and start executing."
                  : "Use onboarding to shape a direction, compare strong options, and keep both your software and research tracks visible."
              }
              className="text-paper [&_.editorial-kicker]:text-paper/55 [&_h1]:text-paper [&_p]:text-paper/72"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href={nextAction.href} className="rounded-full px-6">
              {nextAction.label}
            </Button>
            <Button
              href="/recommendations"
              variant="outline"
              className="rounded-full border-contrast-line bg-paper/6 text-paper hover:bg-paper/12"
            >
              View ideas
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Current plan"
          value={getPlanLabel(plan)}
          detail={plan === "pro_monthly" ? "Premium workspace enabled." : "Free plan with essential guidance."}
        />
        <StatCard
          label="Recommendation batches used"
          value={recommendationBatches}
          detail="Total generations across both tracks."
        />
        <StatCard label="Saved projects" value={projects.length} detail="Active, paused, and completed work in one place." />
      </div>

      <TrackSection
        title="Software Projects"
        projects={softwareProjects}
        track="software"
        hasIntake={trackAvailability.software.hasIntake}
        recommendationCount={trackAvailability.software.recommendationCount}
      />

      <TrackSection
        title="Research Projects"
        projects={researchProjects}
        track="research"
        hasIntake={trackAvailability.research.hasIntake}
        recommendationCount={trackAvailability.research.recommendationCount}
      />
    </div>
  );
}

function TrackSection({
  title,
  projects,
  track,
  hasIntake,
  recommendationCount,
}: {
  title: string;
  projects: Array<{ id: string; title: string; status: string; hasRoadmap: boolean }>;
  track: "software" | "research";
  hasIntake: boolean;
  recommendationCount: number;
}) {
  const nextActionHref = hasIntake ? `/recommendations?track=${track}` : "/onboarding";
  const nextActionLabel = hasIntake ? `Open ${track} ideas` : "Complete onboarding";
  const trackTheme = trackThemes[track];

  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={trackTheme.badgeTone}>{getTrackLabel(track)}</Badge>
            <Badge tone={hasIntake ? "success" : "warning"}>{hasIntake ? "Intake ready" : "Needs setup"}</Badge>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-ink">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {track === "software"
                ? "Keep your saved software builds moving and regenerate ideas whenever you need another angle."
                : "Keep your saved research directions visible and make deliberate tradeoffs before you commit."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button href={nextActionHref} className="rounded-full px-5">
            {nextActionLabel}
          </Button>
          <Button href={`/recommendations?track=${track}`} variant="outline" className="rounded-full">
            View board
          </Button>
        </div>
      </div>

      <div className={`grid gap-4 rounded-2xl border p-5 ${trackTheme.accentSurfaceClassName} ${trackTheme.borderClassName}`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="editorial-kicker">Saved projects</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{projects.length}</p>
          </div>
          <div>
            <p className="editorial-kicker">Recommendation history</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{recommendationCount}</p>
          </div>
          <div>
            <p className="editorial-kicker">Track state</p>
            <p className="mt-3 text-lg font-semibold text-ink">{hasIntake ? "Ready for action" : "Needs direction"}</p>
          </div>
        </div>
      </div>

      {projects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <Badge tone={trackTheme.badgeTone}>{track === "software" ? "Software" : "Research"}</Badge>
                <Badge tone={project.status === "completed" ? "success" : "neutral"}>{project.status}</Badge>
              </div>
              <div className="mt-5 space-y-3">
                <h3 className="text-xl font-semibold text-ink">{project.title}</h3>
                <p className="text-sm leading-6 text-ink-soft">
                  {project.hasRoadmap ? "Roadmap ready and workspace available." : "Direction chosen. Roadmap still needs to be generated."}
                </p>
              </div>
              <div className="mt-auto pt-8">
                <Button href={`/project/${project.id}`} fullWidth className="rounded-full">
                  Open workspace
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card tone="subtle">
          <p className="text-sm leading-6 text-ink-soft">
            {track === "software"
              ? "Keep your saved software builds moving and regenerate ideas whenever you need another angle."
              : "Keep your saved research projects visible alongside your software work."}
          </p>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            {hasIntake
              ? `No ${track} project saved yet. Generate recommendations for this track and save the strongest one.`
              : `You have not completed ${track} onboarding yet. Run onboarding and choose the ${track === "software" ? "Software Project" : "Research Project"} track to start.`}
          </p>
        </Card>
      )}
    </Card>
  );
}
