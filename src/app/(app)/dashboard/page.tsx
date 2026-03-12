import Link from "next/link";
import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectsForDashboard } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getRecommendationGenerationCount, getTrackAvailability } from "@/lib/db/queries/recommendations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-600">Manage your saved software and research projects in one place.</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Current plan</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">{plan === "pro_monthly" ? "Pro" : "Free"}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Recommendation batches used</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">{recommendationBatches}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink-500">Saved projects</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">{projects.length}</p>
        </Card>
      </div>

      <TrackSection
        title="Software Projects"
        projects={softwareProjects}
        track="software"
        hasIntake={trackAvailability.software.hasIntake}
      />

      <TrackSection
        title="Research Projects"
        projects={researchProjects}
        track="research"
        hasIntake={trackAvailability.research.hasIntake}
      />
    </div>
  );
}

function TrackSection({
  title,
  projects,
  track,
  hasIntake,
}: {
  title: string;
  projects: Array<{ id: string; title: string; status: string; hasRoadmap: boolean }>;
  track: "software" | "research";
  hasIntake: boolean;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <p className="text-sm text-ink-600">
            {track === "software"
              ? "Keep your saved software builds moving and regenerate ideas whenever you need another angle."
              : "Keep your saved research projects visible alongside your software work."}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href={`/recommendations?track=${track}`}>
            <Button>{projects.length ? "View recommendations" : `Open ${track} ideas`}</Button>
          </Link>
          {!hasIntake ? (
            <Link href="/onboarding">
              <Button variant="secondary">Start onboarding</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {projects.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <div key={project.id} className="rounded-lg border border-surface-border p-4">
              <div className="space-y-2">
                <p className="font-medium text-ink-900">{project.title}</p>
                <p className="text-sm text-ink-600">Status: {project.status}</p>
                <p className="text-xs text-ink-500">{project.hasRoadmap ? "Roadmap ready" : "Roadmap not generated yet"}</p>
              </div>
              <div className="mt-4">
                <Link href={`/project/${project.id}`}>
                  <Button className="w-full">Open workspace</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-surface-border p-4 text-sm text-ink-700">
          {hasIntake
            ? `No ${track} project saved yet. Generate recommendations for this track and save the strongest one.`
            : `You have not completed ${track} onboarding yet. Run onboarding and choose the ${track === "software" ? "Software Project" : "Research Project"} track to start.`}
        </div>
      )}
    </Card>
  );
}
