import { getRequiredReviewerUser } from "@/lib/auth/guard";
import { listReviewerProjects } from "@/lib/db/queries/reviewers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

function formatActivity(value: string | null): string {
  if (!value) return "No recent activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recent activity";
  return `Updated ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

export default async function ReviewerDashboardPage() {
  const user = await getRequiredReviewerUser();
  const projects = await listReviewerProjects(user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Reviewer workspace"
        title="Projects you&rsquo;re reviewing"
        description="Open a student&rsquo;s project to see their progress and leave structured feedback on each milestone."
      />

      {projects.length === 0 ? (
        <Card className="space-y-3" padding="lg">
          <Badge tone="neutral">No projects yet</Badge>
          <h2 className="text-xl font-semibold text-ink">You haven&rsquo;t been added to any projects.</h2>
          <p className="text-sm leading-6 text-ink-soft">
            When a student invites you, the invitation link will bring you here. If you&rsquo;re expecting an
            invitation, check your inbox for the email from Sevri.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.project_id} className="flex h-full flex-col" padding="lg">
              <div className="space-y-2">
                <Badge tone="accent">Reviewing</Badge>
                <h3 className="text-lg font-semibold text-ink">{project.project_title}</h3>
                <p className="text-sm leading-6 text-ink-soft">
                  Student: <span className="font-medium text-ink">{project.student_display_name}</span>
                </p>
                <p className="text-xs text-ink-muted">{formatActivity(project.last_student_activity_at)}</p>
              </div>
              <div className="mt-auto pt-6">
                <Button href={`/reviewer/project/${project.project_id}`} fullWidth className="rounded-full">
                  Open project
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
