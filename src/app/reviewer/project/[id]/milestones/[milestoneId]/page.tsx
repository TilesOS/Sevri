import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthenticatedUser, getRequiredReviewerUser } from "@/lib/auth/guard";
import {
  getMilestoneForReviewer,
  listMilestoneReviews,
} from "@/lib/db/queries/reviewers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { LeaveReviewPanel } from "@/components/reviewer/leave-review-panel";
import { stepLabel } from "@/lib/copy/glossary";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>;
}): Promise<Metadata> {
  const { milestoneId } = await params;

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { title: "Step review" };
    }

    const data = await getMilestoneForReviewer(milestoneId, user.id);
    if (!data) {
      return { title: "Step review" };
    }

    return {
      title: `${stepLabel(data.milestone.order_index + 1)} review · ${data.project.title}`,
    };
  } catch {
    return { title: "Step review" };
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ReviewerMilestonePage({
  params,
}: {
  params: Promise<{ id: string; milestoneId: string }>;
}) {
  const user = await getRequiredReviewerUser();
  const { id: projectId, milestoneId } = await params;

  const data = await getMilestoneForReviewer(milestoneId, user.id);
  if (!data || data.milestone.project_id !== projectId) {
    notFound();
  }

  const { milestone, project } = data;
  const [reviews, submission] = await Promise.all([
    listMilestoneReviews(milestoneId),
    getLatestSubmission(milestoneId),
  ]);

  const myReview = reviews.find((review) => review.reviewer_user_id === user.id) ?? null;
  const stepNumber = milestone.order_index + 1;

  const objective =
    (milestone.objective?.trim()?.length ?? 0) > 0
      ? milestone.objective
      : milestone.description ?? "";

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/reviewer/project/${projectId}`}
          className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted hover:text-ink"
        >
          &larr; Back to project
        </Link>
        <Button href="/reviewer" variant="ghost" size="sm">
          All projects
        </Button>
      </div>

      <Card tone="contrast" className="border-contrast-line" padding="lg">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="contrast">{project.title}</Badge>
            <Badge tone={milestone.completed ? "success" : "contrast"}>
              {milestone.completed ? "Complete" : "In progress"}
            </Badge>
          </div>
          <PageHeader
            eyebrow={`Step ${stepNumber}`}
            title={milestone.title}
            description={objective}
            className="text-paper [&_.editorial-kicker]:text-paper/55 [&_h1]:text-paper [&_p]:text-paper/72"
          />
          {milestone.deliverable ? (
            <div className="rounded-2xl border border-white/10 bg-white/6 p-5">
              <p className="editorial-kicker text-paper/55">Deliverable</p>
              <p className="mt-3 text-lg font-semibold text-paper">{milestone.deliverable}</p>
            </div>
          ) : null}
        </div>
      </Card>

      {submission ? (
        <Card className="space-y-4" padding="lg">
          <div className="space-y-1">
            <Badge tone="neutral">Student submission</Badge>
            <h2 className="text-xl font-semibold text-ink">Latest work submitted</h2>
            <p className="text-xs text-ink-muted">
              {submission.submission_kind === "pasted_text" ? "Pasted text" : "File upload"}
              {submission.submission_filename ? ` · ${submission.submission_filename}` : ""}
              <span> · {formatDate(submission.created_at)}</span>
            </p>
          </div>
          {submission.submission_text ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-4 text-xs leading-5 text-ink">
              {submission.submission_text}
            </pre>
          ) : (
            <p className="text-sm leading-6 text-ink-soft">
              The student uploaded a file; open the project workspace to see the full contents.
            </p>
          )}
        </Card>
      ) : (
        <Card padding="lg">
          <p className="text-sm leading-6 text-ink-soft">
            The student hasn&rsquo;t submitted work for this milestone yet. You can still leave feedback on the
            plan.
          </p>
        </Card>
      )}

      <LeaveReviewPanel
        milestoneId={milestoneId}
        submissionId={submission?.id ?? null}
        existingReview={
          myReview
            ? {
                strength: myReview.strength,
                tighten: myReview.tighten,
                next_action: myReview.next_action,
                ready_to_mark_complete: myReview.ready_to_mark_complete,
                created_at: myReview.created_at,
              }
            : null
        }
      />
    </div>
  );
}

async function getLatestSubmission(milestoneId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("milestone_submissions")
    .select("id, submission_kind, submission_text, submission_filename, created_at")
    .eq("milestone_id", milestoneId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}
