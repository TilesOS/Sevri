"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ReviewerInviteModal } from "@/components/reviewer/reviewer-invite-modal";
import { reviewerLimit } from "@/lib/usage/limits";
import type {
  ProjectInvitationSummary,
  ProjectReviewerSummary,
} from "@/lib/db/queries/reviewers";
import type { Plan } from "@/types/domain";

interface ReviewersCardProps {
  projectId: string;
  plan: Plan;
  reviewers: ProjectReviewerSummary[];
  invitations: ProjectInvitationSummary[];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function resolveReviewerLabel(reviewer: ProjectReviewerSummary) {
  const display = reviewer.display_name?.trim();
  if (display && display.length > 0) return display;
  const full = reviewer.full_name?.trim();
  if (full && full.length > 0) return full;
  return "Reviewer";
}

export function ReviewersCard({ projectId, plan, reviewers, invitations }: ReviewersCardProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const limit = reviewerLimit(plan);
  const activeCount = reviewers.length + invitations.length;
  const isPro = plan === "pro_monthly";
  const canInvite = isPro && activeCount < limit;

  async function revokeReviewer(reviewerRowId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(reviewerRowId);
    try {
      const res = await fetch(`/api/projects/${projectId}/reviewers/${reviewerRowId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to remove reviewer.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function revokeInvitation(invitationId: string) {
    if (pendingId) return;
    setError(null);
    setPendingId(invitationId);
    try {
      const res = await fetch(`/api/projects/${projectId}/invitations/${invitationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to revoke invitation.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="editorial-kicker">Reviewers</p>
          <h3 className="text-xl font-semibold text-ink">Invite a trusted outside eye</h3>
          <p className="text-sm leading-6 text-ink-soft">
            Reviewers see a read-only view of this project and leave structured feedback per milestone.
          </p>
        </div>
        <Badge tone="neutral">
          {isPro ? `${activeCount} of ${limit}` : "Pro feature"}
        </Badge>
      </div>

      {!isPro ? (
        <Alert tone="info" heading="Reviewers are a Pro feature">
          Upgrade to Pro to invite up to {reviewerLimit("pro_monthly")} reviewers per project.{" "}
          <Link href="/settings/billing" className="font-semibold underline">
            Upgrade to Pro
          </Link>
        </Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {reviewers.length === 0 && invitations.length === 0 ? (
        <p className="text-sm leading-6 text-ink-soft">
          No reviewers yet. Invite a teacher, mentor, or peer to read your roadmap and leave feedback.
        </p>
      ) : (
        <ul className="space-y-3">
          {reviewers.map((reviewer) => (
            <li
              key={reviewer.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-ink">{resolveReviewerLabel(reviewer)}</p>
                  <Badge tone="success">Active</Badge>
                </div>
                <p className="text-xs text-ink-muted">Joined {formatDate(reviewer.joined_at)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => revokeReviewer(reviewer.id)}
                disabled={pendingId === reviewer.id}
              >
                {pendingId === reviewer.id ? "Removing..." : "Remove"}
              </Button>
            </li>
          ))}
          {invitations.map((invitation) => (
            <li
              key={invitation.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-canvas px-4 py-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-ink">{invitation.reviewer_email}</p>
                  <Badge tone="warning">Pending</Badge>
                </div>
                <p className="text-xs text-ink-muted">
                  Invited {formatDate(invitation.created_at)} &middot; expires {formatDate(invitation.expires_at)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => revokeInvitation(invitation.id)}
                disabled={pendingId === invitation.id}
              >
                {pendingId === invitation.id ? "Revoking..." : "Revoke"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => setModalOpen(true)}
          disabled={!canInvite}
          className="px-4"
        >
          Invite reviewer
        </Button>
      </div>

      <ReviewerInviteModal
        projectId={projectId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </Card>
  );
}
