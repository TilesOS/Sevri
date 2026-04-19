import Link from "next/link";
import { notFound } from "next/navigation";
import { getRequiredReviewerUser } from "@/lib/auth/guard";
import { getReviewerProjectWorkspace } from "@/lib/db/queries/reviewers";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";

export const dynamic = "force-dynamic";

type MilestoneRow = {
  id: string;
  order_index: number;
  title: string;
  description: string | null;
  objective: string | null;
  deliverable: string | null;
  rough_time_estimate: string | null;
  completed: boolean;
};

export default async function ReviewerProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredReviewerUser();
  const { id } = await params;

  const workspace = await getReviewerProjectWorkspace(id, user.id);

  if (!workspace) {
    notFound();
  }

  const { project, roadmap, milestones } = workspace;
  const typedMilestones = (milestones ?? []) as MilestoneRow[];
  const completedCount = typedMilestones.filter((m) => m.completed).length;
  const completionPercent =
    typedMilestones.length === 0 ? 0 : Math.round((completedCount / typedMilestones.length) * 100);
  const overview =
    typeof roadmap?.overview === "string" && roadmap.overview.trim().length > 0
      ? roadmap.overview
      : null;

  return (
    <div className="space-y-8">
      <Card tone="contrast" className="border-contrast-line" padding="lg">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="contrast">Read-only</Badge>
            <Badge tone="contrast">{project.status}</Badge>
          </div>
          <PageHeader
            eyebrow="Reviewer workspace"
            title={project.title}
            description={overview ?? "The student&rsquo;s roadmap and progress."}
            className="text-paper [&_.editorial-kicker]:text-paper/55 [&_h1]:text-paper [&_p]:text-paper/72"
          />
          {typedMilestones.length > 0 ? (
            <ProgressBar
              value={completionPercent}
              label="Student progress"
              helperText={`${completedCount} of ${typedMilestones.length} milestones complete`}
              className="[&_.text-ink]:text-paper [&_.text-ink-muted]:text-paper/55"
            />
          ) : null}
        </div>
      </Card>

      {!roadmap ? (
        <Card padding="lg">
          <p className="text-sm leading-6 text-ink-soft">
            The student hasn&rsquo;t generated a roadmap yet. Come back once they do.
          </p>
        </Card>
      ) : (
        <Card className="space-y-4" padding="lg">
          <div className="space-y-2">
            <p className="editorial-kicker">Milestones</p>
            <h2 className="text-2xl font-semibold text-ink">What the student is building toward</h2>
            <p className="text-sm leading-6 text-ink-soft">
              Each milestone has a concrete deliverable. Leaving feedback on specific milestones unlocks later
              once review panels ship.
            </p>
          </div>

          <ol className="space-y-3">
            {typedMilestones.map((milestone) => {
              const stepNumber = milestone.order_index + 1;
              const title = milestone.title;
              const objective =
                milestone.objective && milestone.objective.trim().length > 0
                  ? milestone.objective
                  : milestone.description ?? "";
              const deliverable = milestone.deliverable ?? "";

              return (
                <li key={milestone.id}>
                  <Link
                    href={`/reviewer/project/${id}/milestones/${milestone.id}`}
                    className="block transition hover:opacity-90"
                  >
                    <Card tone={milestone.completed ? "primary" : "subtle"} padding="md">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">
                            Step {stepNumber}
                          </p>
                          <p className="text-lg font-semibold text-ink">{title}</p>
                        </div>
                        <Badge tone={milestone.completed ? "success" : "neutral"}>
                          {milestone.completed ? "Complete" : "In progress"}
                        </Badge>
                      </div>
                      {objective ? (
                        <p className="mt-3 text-sm leading-6 text-ink-soft">{objective}</p>
                      ) : null}
                      {deliverable ? (
                        <p className="mt-3 text-xs text-ink-muted">
                          <span className="font-semibold uppercase tracking-wide">Deliverable: </span>
                          {deliverable}
                        </p>
                      ) : null}
                      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        Open to review &rarr;
                      </p>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>
      )}
    </div>
  );
}
