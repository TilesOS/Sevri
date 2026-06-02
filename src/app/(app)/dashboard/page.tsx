import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectsForDashboard } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getRecommendationGenerationCount, getTrackAvailability } from "@/lib/db/queries/recommendations";
import { PLAN_LIMITS } from "@/lib/usage/limits";
import { getPlanLabel, getTrackLabel, trackThemes } from "@/components/theme/theme-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

export default async function DashboardPage() {
  const user = await getRequiredUser();
  const [projects, plan, recommendationGenerations, trackAvailability] = await Promise.all([
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
          label: "Open idea board",
        }
      : {
          href: "/onboarding",
          label: "Start onboarding",
        };

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <div style={{ marginBottom: 8 }}>
        <div className="kicker" style={{ marginBottom: 10 }}>
          <span className="star">✦</span>
          <span>WORKSPACE</span>
        </div>
        <h1 className="display big" style={{ margin: 0 }}>
          welcome{" "}
          <span className="hl-yellow">back</span>
          <span style={{ color: 'var(--pink)' }}>.</span>
        </h1>
      </div>

      {/* Hero coach card */}
      <div className="coach" style={{ boxShadow: '6px 6px 0 var(--cyan)' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="kicker" style={{ color: 'rgba(251,246,233,0.6)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--cyan)' }}>✦</span>
            {activeProject ? "CONTINUE YOUR JOURNEY" : "SET THE DIRECTION"}
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,48px)', fontWeight: 400, letterSpacing: '-0.03em', lineHeight: 0.96, color: 'var(--paper)', margin: '0 0 16px', maxWidth: 680 }}>
            {activeProject ? activeProject.title : "Set the direction worth finishing."}
          </h2>
          <p style={{ color: 'rgba(251,246,233,0.72)', fontSize: 15, lineHeight: 1.6, maxWidth: 560, marginBottom: 24 }}>
            {activeProject
              ? activeProject.hasRoadmap
                ? "Your workspace is ready. Keep the next milestone moving and protect the finishable version of the project."
                : "You have already chosen a direction. The next move is to turn it into a roadmap and start executing."
              : "Use onboarding to shape a direction, compare strong options, and keep both your software and research tracks visible."}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button href={nextAction.href} className="px-6">
              {nextAction.label}
            </Button>
            <Button
              href="/recommendations"
              variant="outline"
              className="border-contrast-line bg-paper/10 text-paper hover:bg-paper/20"
            >
              View ideas
            </Button>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="Current plan"
          value={getPlanLabel(plan)}
          detail={
            plan === "pro_monthly"
              ? "Unlimited idea board generations, subject to fair-use and rate limits, plus Pro coaching."
              : `Includes ${PLAN_LIMITS.free.generation_limit} free idea board generations plus roadmap access.`
          }
        />
        <StatCard
          label="Idea board generations used"
          value={recommendationGenerations}
          detail="Total idea board generations across both tracks."
        />
        <StatCard label="Saved projects" value={projects.length} detail="Active, paused, and completed work in one place." />
      </div>

      <TrackSection
        title="Software Projects"
        projects={softwareProjects.slice(0, 3)}
        track="software"
        hasIntake={trackAvailability.software.hasIntake}
        recommendationCount={trackAvailability.software.recommendationCount}
      />

      <TrackSection
        title="Research Projects"
        projects={researchProjects.slice(0, 3)}
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

  const accentColor = track === "software" ? "var(--yellow)" : "var(--cyan)";

  return (
    <Card className="space-y-6" style={{ borderTop: `4px solid ${accentColor}` }}>
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
                ? "Keep your saved software builds moving and revisit new ideas when you need another angle."
                : "Keep your saved research directions visible and make deliberate tradeoffs before you commit."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button href={nextActionHref} className="px-5">
            {nextActionLabel}
          </Button>
          <Button href={`/recommendations?track=${track}`} variant="outline">
            View board
          </Button>
        </div>
      </div>

      <div className="grid gap-6 rounded-md bg-canvas px-5 py-4 sm:grid-cols-3" style={{ border: '2px solid var(--ink)' }}>
        <div style={{ borderLeft: '3px solid var(--yellow)', paddingLeft: 12 }}>
          <p className="editorial-kicker">Saved projects</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{projects.length}</p>
        </div>
        <div style={{ borderLeft: '3px solid var(--cyan)', paddingLeft: 12 }}>
          <p className="editorial-kicker">Saved directions</p>
          <p className="mt-3 text-3xl font-semibold text-ink">{recommendationCount}</p>
        </div>
        <div style={{ borderLeft: '3px solid var(--pink)', paddingLeft: 12 }}>
          <p className="editorial-kicker">Track state</p>
          <p className="mt-3 text-lg font-semibold text-ink">{hasIntake ? "Ready for action" : "Needs direction"}</p>
        </div>
      </div>

      {projects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => (
            <Card key={project.id} tone="subtle" className="flex h-full flex-col" style={{ borderTop: `3px solid ${index % 2 === 0 ? accentColor : 'var(--pink)'}` }}>
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
                <Button href={`/project/${project.id}`} fullWidth>
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
              ? "Keep your saved software builds moving and revisit new ideas when you need another angle."
              : "Keep your saved research projects visible alongside your software work."}
          </p>
          <p className="mt-3 text-sm leading-6 text-ink-soft">
            {hasIntake
              ? `No ${track} project saved yet. Generate an idea board for this track and save the strongest direction.`
              : `You have not completed ${track} onboarding yet. Run onboarding and choose the ${track === "software" ? "Software Project" : "Research Project"} track to start.`}
          </p>
        </Card>
      )}
    </Card>
  );
}
