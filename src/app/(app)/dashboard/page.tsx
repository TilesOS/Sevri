import Link from "next/link";
import { getRequiredUser } from "@/lib/auth/guard";
import { getActiveProject } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getRecommendationGenerationCount } from "@/lib/db/queries/recommendations";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const user = await getRequiredUser();
  const [project, plan, recommendationBatches] = await Promise.all([
    getActiveProject(user.id),
    getUserPlan(user.id),
    getRecommendationGenerationCount(user.id),
  ]);

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <h1 className="text-2xl font-bold text-ink-900">Dashboard</h1>
        <p className="text-sm text-ink-600">Keep your standout project moving.</p>
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
          <p className="text-xs uppercase tracking-wide text-ink-500">Project status</p>
          <p className="mt-2 text-2xl font-semibold text-ink-900">{project ? project.status : "No project selected"}</p>
        </Card>
      </div>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-ink-900">Next action</h2>
        {project ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-medium text-ink-900">{project.title}</p>
              <p className="text-sm text-ink-600">Continue milestones and keep scope tight.</p>
            </div>
            <Link href={`/project/${project.id}`}>
              <Button>Open workspace</Button>
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-ink-700">Finish onboarding and generate your first recommendations.</p>
            <div className="flex gap-3">
              <Link href="/onboarding">
                <Button variant="secondary">Start onboarding</Button>
              </Link>
              <Link href="/recommendations">
                <Button>View recommendations</Button>
              </Link>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}