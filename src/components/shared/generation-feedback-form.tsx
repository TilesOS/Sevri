"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { FeedbackSignal, FeedbackStage } from "@/types/domain";

interface RecommendationChoice {
  id: string;
  title: string;
}

type FeedbackAnchorProps =
  | {
      stage: "recommendations";
      normalizedProfileId: string;
      recommendations: RecommendationChoice[];
    }
  | {
      stage: "roadmap";
      roadmapId: string;
    }
  | {
      stage: "step_guidance";
      milestoneGuidanceId: string;
    }
  | {
      stage: "work_evaluation";
      submissionEvaluationId: string;
    };

type GenerationFeedbackFormProps = FeedbackAnchorProps & {
  className?: string;
  title?: string;
  description?: string;
};

const signalOptions: Array<{ value: FeedbackSignal; label: string }> = [
  { value: "good", label: "Good" },
  { value: "mixed", label: "Mixed" },
  { value: "bad", label: "Bad" },
];

export function GenerationFeedbackForm({
  className,
  title = "Help Sevri improve",
  description = "Optional. Share what felt right, off, or missing so the next generation gets sharper.",
  ...props
}: GenerationFeedbackFormProps) {
  const [signal, setSignal] = useState<FeedbackSignal | null>(null);
  const [notes, setNotes] = useState("");
  const [closestRecommendationId, setClosestRecommendationId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  function buildBody() {
    const base = {
      stage: props.stage as FeedbackStage,
      signal,
      notes,
    };

    if (props.stage === "recommendations") {
      return {
        ...base,
        normalized_profile_id: props.normalizedProfileId,
        closest_recommendation_id: closestRecommendationId || undefined,
      };
    }

    if (props.stage === "roadmap") {
      return { ...base, roadmap_id: props.roadmapId };
    }

    if (props.stage === "step_guidance") {
      return { ...base, milestone_guidance_id: props.milestoneGuidanceId };
    }

    return { ...base, submission_evaluation_id: props.submissionEvaluationId };
  }

  function submitFeedback() {
    if (!signal) {
      setError("Choose whether this felt good, mixed, or bad.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Failed to save feedback.");
        return;
      }

      setSubmitted(true);
    });
  }

  return (
    <Card className={cn("space-y-4", className)} tone="subtle">
      <div className="space-y-2">
        <p className="editorial-kicker">Learning loop</p>
        <h3 className="text-lg font-semibold text-ink">{title}</h3>
        <p className="text-sm leading-6 text-ink-soft">{description}</p>
      </div>

      {submitted ? <Alert tone="success">Thanks. Sevri will use this feedback to sharpen future generations.</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {!submitted ? (
        <>
          <div className="flex flex-wrap gap-2">
            {signalOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={signal === option.value ? "primary" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => setSignal(option.value)}
                disabled={isPending}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {props.stage === "recommendations" ? (
            <FormField
              label="Closest option"
              hint="Optional. Pick the option that came closest to what you wanted."
            >
              <Select
                value={closestRecommendationId}
                onChange={(event) => setClosestRecommendationId(event.target.value)}
                disabled={isPending}
              >
                <option value="">None selected</option>
                {props.recommendations.map((recommendation) => (
                  <option key={recommendation.id} value={recommendation.id}>
                    {recommendation.title}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : null}

          <FormField
            label="Notes"
            hint="Optional. A sentence or two is enough."
          >
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What felt generic, what almost fit, or what you expected instead..."
              disabled={isPending}
            />
          </FormField>

          <div className="flex justify-end">
            <Button type="button" onClick={submitFeedback} disabled={isPending} className="rounded-full px-6">
              {isPending ? "Saving..." : "Send feedback"}
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
