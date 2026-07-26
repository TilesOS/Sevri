"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MIN_LENGTH = 10;
const MAX_LENGTH = 500;

interface LeaveReviewPanelProps {
  milestoneId: string;
  submissionId?: string | null;
  existingReview: {
    strength: string;
    tighten: string;
    next_action: string;
    ready_to_mark_complete: boolean;
    created_at: string;
  } | null;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function LeaveReviewPanel({ milestoneId, submissionId, existingReview }: LeaveReviewPanelProps) {
  const router = useRouter();
  const [strength, setStrength] = useState(existingReview?.strength ?? "");
  const [tighten, setTighten] = useState(existingReview?.tighten ?? "");
  const [nextAction, setNextAction] = useState(existingReview?.next_action ?? "");
  const [readyToMarkComplete, setReadyToMarkComplete] = useState(
    existingReview?.ready_to_mark_complete ?? false,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldStates = [
    { name: "strength", value: strength },
    { name: "tighten", value: tighten },
    { name: "next_action", value: nextAction },
  ];
  const allFieldsValid = fieldStates.every(
    (field) => field.value.trim().length >= MIN_LENGTH && field.value.length <= MAX_LENGTH,
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allFieldsValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/milestones/${milestoneId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strength,
          tighten,
          next_action: nextAction,
          ready_to_mark_complete: readyToMarkComplete,
          submission_id: submissionId ?? undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to save review.");
        setIsSubmitting(false);
        return;
      }

      router.refresh();
      setIsSubmitting(false);
    } catch {
      setError("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="space-y-5" padding="lg">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Leave review</Badge>
          {existingReview ? (
            <Badge tone="neutral">Last saved {formatDate(existingReview.created_at)}</Badge>
          ) : null}
        </div>
        <h3 className="text-xl font-semibold text-ink">Structured feedback on this step</h3>
        <p className="text-sm leading-6 text-ink-soft">
          Three short fields, no free-form comments. Submitting a new review supersedes your previous one for this
          step &mdash; the student sees your latest answers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <ReviewField
          id="strength"
          label="What&rsquo;s the strength here?"
          hint="What should the student keep, protect, or build on?"
          value={strength}
          onChange={setStrength}
        />
        <ReviewField
          id="tighten"
          label="What would you tighten?"
          hint="Where could the work be sharper, clearer, or more focused?"
          value={tighten}
          onChange={setTighten}
        />
        <ReviewField
          id="next_action"
          label="Suggested next action"
          hint="The single most useful next step, in one or two sentences."
          value={nextAction}
          onChange={setNextAction}
        />

        <label className="flex items-start gap-3 rounded-xl border border-line bg-canvas/60 px-4 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-line accent-primary"
            checked={readyToMarkComplete}
            onChange={(event) => setReadyToMarkComplete(event.target.checked)}
          />
          <span className="text-sm leading-6 text-ink">
            <span className="font-semibold">This step looks ready to mark complete.</span>
            <span className="block text-xs leading-5 text-ink-muted">
              Leave unchecked if you think the student should revise before moving on.
            </span>
          </span>
        </label>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-muted">
            Each answer must be at least {MIN_LENGTH} characters and at most {MAX_LENGTH}.
          </p>
          <Button type="submit" disabled={!allFieldsValid || isSubmitting}>
            {isSubmitting
              ? "Saving..."
              : existingReview
                ? "Update review"
                : "Submit review"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ReviewField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const trimmedLength = value.trim().length;
  const rawLength = value.length;
  const tooShort = trimmedLength > 0 && trimmedLength < MIN_LENGTH;
  const tooLong = rawLength > MAX_LENGTH;

  return (
    <FormField label={label} htmlFor={id} hint={hint}>
      <Textarea
        id={id}
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        minLength={MIN_LENGTH}
        maxLength={MAX_LENGTH}
      />
      <p
        className={cn(
          "mt-1 text-xs",
          tooShort || tooLong ? "font-medium text-red-600" : "text-ink-muted",
        )}
      >
        {rawLength} / {MAX_LENGTH} characters
        {tooShort ? ` — at least ${MIN_LENGTH} required` : ""}
      </p>
    </FormField>
  );
}
