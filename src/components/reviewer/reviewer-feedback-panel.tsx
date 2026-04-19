import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { MilestoneReviewRow } from "@/lib/db/queries/reviewers";

interface ReviewerFeedbackPanelProps {
  reviews: MilestoneReviewRow[];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function resolveReviewerName(review: MilestoneReviewRow) {
  const display = review.reviewer_display_name?.trim();
  if (display && display.length > 0) return display;
  const full = review.reviewer_full_name?.trim();
  if (full && full.length > 0) return full;
  return "Reviewer";
}

export function ReviewerFeedbackPanel({ reviews }: ReviewerFeedbackPanelProps) {
  if (reviews.length === 0) {
    return (
      <Card className="space-y-3" padding="lg">
        <Badge tone="neutral">Reviewer feedback</Badge>
        <p className="text-sm leading-6 text-ink-soft">
          No reviews on this milestone yet. When one of your reviewers leaves feedback, it will appear here.
        </p>
      </Card>
    );
  }

  return (
    <Card className="space-y-5" padding="lg">
      <div className="space-y-1">
        <Badge tone="accent">Reviewer feedback</Badge>
        <h3 className="text-xl font-semibold text-ink">What your reviewers are saying</h3>
        <p className="text-sm leading-6 text-ink-soft">
          Latest review per reviewer. Re-reviews replace the previous version.
        </p>
      </div>

      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id} tone="subtle" padding="md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{resolveReviewerName(review)}</p>
              <div className="flex items-center gap-2">
                <Badge tone={review.ready_to_mark_complete ? "success" : "warning"}>
                  {review.ready_to_mark_complete ? "Ready" : "Not yet"}
                </Badge>
                <span className="text-xs text-ink-muted">{formatDate(review.created_at)}</span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <ReviewLine label="Strength" value={review.strength} />
              <ReviewLine label="What to tighten" value={review.tighten} />
              <ReviewLine label="Suggested next action" value={review.next_action} />
            </div>
          </Card>
        ))}
      </div>
    </Card>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}
