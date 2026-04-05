"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GenerationFeedbackForm } from "@/components/shared/generation-feedback-form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  LatestCompletedMilestoneEvaluation,
  MilestoneEvaluationResponse,
  StepGuidance,
  StoredMilestoneSubmission,
  WorkEvaluation,
} from "@/types/domain";

interface Milestone {
  id: string;
  order_index: number;
  title: string;
  description: string;
  objective?: string | null;
  deliverable?: string | null;
  rough_time_estimate?: string | null;
  completed: boolean;
}

interface RouteErrorBody {
  error?: string;
  code?: "upgrade_required";
  feature?: "full_roadmap";
  upgrade_url?: string;
}

interface GuidanceSlot {
  guidance: StepGuidance;
  guidanceId: string;
}

type SubmissionSlot =
  | { status: "unloaded" }
  | { status: "loading" }
  | { status: "empty" }
  | {
      status: "pending";
      submission: StoredMilestoneSubmission;
      latestCompletedEvaluation: LatestCompletedMilestoneEvaluation | null;
    }
  | {
      status: "failed";
      submission: StoredMilestoneSubmission;
      failureMessage: string | null;
      latestCompletedEvaluation: LatestCompletedMilestoneEvaluation | null;
    }
  | {
      status: "completed";
      submission: StoredMilestoneSubmission;
      evaluationId: string;
      evaluation: WorkEvaluation;
    };

const ACCEPTED_FILE_EXTENSIONS = ".py,.js,.ts,.jsx,.tsx,.html,.css,.md,.txt,.json,.csv,.sql";
const MAX_SUBMISSION_CHARS = 20_000;
const NOTES_SEPARATOR = "\n\n--- Notes ---\n\n";

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatSubmissionKind(kind: string, filename: string | null) {
  if (kind === "pasted_text") return "Pasted text";
  if (filename) return `File: ${filename}`;
  return "File upload";
}

const VERDICT_TONE: Record<string, "success" | "warning" | "danger"> = {
  pass: "success",
  partial: "warning",
  not_yet: "danger",
};

const VERDICT_LABEL: Record<string, string> = {
  pass: "Pass",
  partial: "Partial",
  not_yet: "Not yet",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

function buildSubmissionSlot(body: MilestoneEvaluationResponse | null | undefined): SubmissionSlot {
  if (!body?.current_submission) {
    return { status: "empty" };
  }

  const currentSubmission = body.current_submission;
  const currentEvaluation = body.current_evaluation;
  const latestCompletedEvaluation = body.latest_completed_evaluation ?? null;

  if (currentEvaluation?.status === "completed" && currentEvaluation.evaluation) {
    return {
      status: "completed",
      submission: currentSubmission,
      evaluationId: currentEvaluation.id ?? "",
      evaluation: currentEvaluation.evaluation,
    };
  }

  if (currentEvaluation?.status === "failed") {
    return {
      status: "failed",
      submission: currentSubmission,
      failureMessage: currentEvaluation.failure_message,
      latestCompletedEvaluation,
    };
  }

  return {
    status: "pending",
    submission: currentSubmission,
    latestCompletedEvaluation,
  };
}

function getFallbackEvaluation(slot: SubmissionSlot | undefined) {
  if (!slot || (slot.status !== "pending" && slot.status !== "failed")) {
    return null;
  }

  const fallback = slot.latestCompletedEvaluation;
  if (!fallback || fallback.submission.id === slot.submission.id) {
    return null;
  }

  return fallback;
}

export function MilestoneChecklist({ milestones }: { milestones: Milestone[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [guidanceById, setGuidanceById] = useState<Record<string, GuidanceSlot>>({});
  const [guidancePendingId, setGuidancePendingId] = useState<string | null>(null);
  const [guidanceErrorById, setGuidanceErrorById] = useState<Record<string, string>>({});
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [submissionById, setSubmissionById] = useState<Record<string, SubmissionSlot>>({});
  const [evaluationPendingId, setEvaluationPendingId] = useState<string | null>(null);
  const [evaluationErrorById, setEvaluationErrorById] = useState<Record<string, string>>({});
  const [resubmitModeById, setResubmitModeById] = useState<Record<string, boolean>>({});

  async function toggleMilestone(milestone: Milestone) {
    setPendingId(milestone.id);
    setToggleError(null);

    const response = await fetch(`/api/milestones/${milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !milestone.completed }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setToggleError(body?.error ?? "Failed to update milestone.");
      setPendingId(null);
      return;
    }

    setPendingId(null);
    router.refresh();
  }

  async function fetchGuidance(milestoneId: string, refresh = false) {
    setGuidancePendingId(milestoneId);
    setGuidanceErrorById((current) => ({ ...current, [milestoneId]: "" }));

    const response = await fetch(`/api/ai/milestones/${milestoneId}/guidance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    const body = (await response.json().catch(() => null)) as
      | ({ guidance?: StepGuidance; milestone_guidance_id?: string } & RouteErrorBody)
      | null;

    if (!response.ok || !body?.guidance || !body.milestone_guidance_id) {
      setGuidanceErrorById((current) => ({
        ...current,
        [milestoneId]: body?.error ?? "Failed to load step guidance.",
      }));
      setGuidancePendingId(null);
      return;
    }

    setGuidanceById((current) => ({
      ...current,
      [milestoneId]: {
        guidance: body.guidance!,
        guidanceId: body.milestone_guidance_id!,
      },
    }));
    setExpandedId(milestoneId);
    setGuidancePendingId(null);
  }

  async function fetchSubmissionState(milestoneId: string) {
    const response = await fetch(`/api/ai/milestones/${milestoneId}/evaluate`);
    const body = (await response.json().catch(() => null)) as (MilestoneEvaluationResponse & RouteErrorBody) | null;

    if (!response.ok || !body) {
      throw new Error(body?.error ?? "Failed to load saved evaluation.");
    }

    return body;
  }

  async function loadSubmission(milestoneId: string) {
    setSubmissionById((prev) => ({ ...prev, [milestoneId]: { status: "loading" } }));
    setEvaluationErrorById((prev) => ({ ...prev, [milestoneId]: "" }));

    try {
      const body = await fetchSubmissionState(milestoneId);
      setSubmissionById((prev) => ({
        ...prev,
        [milestoneId]: buildSubmissionSlot(body),
      }));
    } catch {
      setSubmissionById((prev) => ({ ...prev, [milestoneId]: { status: "empty" } }));
      setEvaluationErrorById((prev) => ({
        ...prev,
        [milestoneId]: "Network error. Failed to load saved evaluation.",
      }));
    }
  }

  async function submitWork(
    milestoneId: string,
    text: string,
    kind: "pasted_text" | "file_upload",
    filename?: string,
  ) {
    setEvaluationPendingId(milestoneId);
    setEvaluationErrorById((prev) => ({ ...prev, [milestoneId]: "" }));

    try {
      const response = await fetch(`/api/ai/milestones/${milestoneId}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_text: text,
          submission_kind: kind,
          submission_filename: filename,
        }),
      });

      const body = (await response.json().catch(() => null)) as (MilestoneEvaluationResponse & RouteErrorBody) | null;

      if (!response.ok || !body) {
        setEvaluationErrorById((prev) => ({
          ...prev,
          [milestoneId]: body?.error ?? "Failed to save your submission.",
        }));
        try {
          const recovered = await fetchSubmissionState(milestoneId);
          setSubmissionById((prev) => ({
            ...prev,
            [milestoneId]: buildSubmissionSlot(recovered),
          }));
        } catch {
          // Keep the prior submission state if recovery fails.
        }
        setEvaluationPendingId(null);
        return;
      }

      setSubmissionById((prev) => ({
        ...prev,
        [milestoneId]: buildSubmissionSlot(body),
      }));
      setEvaluationErrorById((prev) => ({ ...prev, [milestoneId]: "" }));
      setResubmitModeById((prev) => ({ ...prev, [milestoneId]: false }));
    } catch {
      try {
        const recovered = await fetchSubmissionState(milestoneId);
        setSubmissionById((prev) => ({
          ...prev,
          [milestoneId]: buildSubmissionSlot(recovered),
        }));
        setEvaluationErrorById((prev) => ({ ...prev, [milestoneId]: "" }));
        setResubmitModeById((prev) => ({ ...prev, [milestoneId]: false }));
      } catch {
        setEvaluationErrorById((prev) => ({
          ...prev,
          [milestoneId]: "Network error. Your submission may have been saved - refresh and try again.",
        }));
      }
    }

    setEvaluationPendingId(null);
  }

  function toggleExpanded(milestoneId: string) {
    if (expandedId === milestoneId) {
      setExpandedId(null);
      return;
    }

    const slot = submissionById[milestoneId];
    if (!slot || slot.status === "unloaded") {
      void loadSubmission(milestoneId);
    }

    if (guidanceById[milestoneId]) {
      setExpandedId(milestoneId);
      return;
    }

    void fetchGuidance(milestoneId);
  }

  return (
    <Card className="space-y-6">
      <div aria-live="polite" className="sr-only">
        {toggleError ??
          Object.values(guidanceErrorById).find(Boolean) ??
          (guidancePendingId ? "Loading milestone guidance." : pendingId ? "Updating milestone." : "")}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Milestones</h2>
          <p className="text-sm leading-6 text-ink-soft">
            Open any milestone when you need premium guidance. The checklist, pitfalls, and done-when bar keep the finishable version visible.
          </p>
        </div>
      </div>

      {toggleError ? <Alert tone="danger">{toggleError}</Alert> : null}

      <ul className="divide-y divide-line">
        {milestones.map((milestone) => {
          const isExpanded = expandedId === milestone.id;
          const guidanceSlot = guidanceById[milestone.id];
          const guidance = guidanceSlot?.guidance;
          const isGuidancePending = guidancePendingId === milestone.id;
          const guidanceError = guidanceErrorById[milestone.id];
          const slot = submissionById[milestone.id];
          const isEvaluationPending = evaluationPendingId === milestone.id;
          const evaluationError = evaluationErrorById[milestone.id];
          const isResubmitMode = resubmitModeById[milestone.id] ?? false;

          return (
            <li key={milestone.id} className="space-y-4 py-5 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 rounded border-line accent-primary"
                      checked={milestone.completed}
                      onChange={() => toggleMilestone(milestone)}
                      disabled={pendingId === milestone.id}
                    />
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={milestone.completed ? "success" : "neutral"}>
                          Step {milestone.order_index + 1}
                        </Badge>
                        <Badge tone="warning">{milestone.rough_time_estimate ?? "About 1 week"}</Badge>
                      </div>
                      <p className="text-xl font-semibold text-ink">{milestone.title}</p>
                    </div>
                  </label>

                  <div className="space-y-3 pl-8 text-sm text-ink-soft">
                    <p>{milestone.objective ?? milestone.description}</p>
                    <div className="rounded-lg bg-canvas p-4">
                      <p className="editorial-kicker">Deliverable</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{milestone.deliverable ?? "Concrete step output"}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toggleExpanded(milestone.id)}
                    disabled={isGuidancePending}
                    className="rounded-full"
                  >
                    {isExpanded ? "Hide guidance" : isGuidancePending ? "Loading..." : "Open guidance"}
                  </Button>
                  {isExpanded ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void fetchGuidance(milestone.id, true)}
                      disabled={isGuidancePending}
                      className="rounded-full"
                    >
                      {isGuidancePending ? "Refreshing..." : "Refresh guidance"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {guidanceError ? <Alert tone="danger">{guidanceError}</Alert> : null}

              <AnimatePresence initial={false}>
                {isExpanded && guidance ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.24, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 border-t border-line pt-5">
                      <Card tone="subtle">
                        <p className="editorial-kicker">What to do now</p>
                        <p className="mt-3 text-sm leading-6 text-ink-soft">{guidance.what_to_do_now}</p>
                      </Card>

                      <div className="grid gap-4">
                        <GuidanceBlock title="Detailed checklist" tone="default">
                          <GuidanceList items={guidance.checklist} variant="ordered" />
                        </GuidanceBlock>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <GuidanceBlock title="Common pitfalls" tone="blush">
                          <GuidanceList items={guidance.pitfalls} />
                        </GuidanceBlock>

                        <GuidanceBlock title="Tools and resources" tone="default">
                          <GuidanceList items={guidance.tools_resources} />
                        </GuidanceBlock>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <GuidanceBlock title="Done when" tone="default">
                          <GuidanceList items={guidance.done_when} />
                        </GuidanceBlock>

                        <GuidanceBlock title="Coaching note" tone="contrast">
                          <p className="text-sm leading-6 text-paper/72">{guidance.encouragement}</p>
                        </GuidanceBlock>
                      </div>

                      {guidanceSlot ? (
                        <GenerationFeedbackForm
                          stage="step_guidance"
                          milestoneGuidanceId={guidanceSlot.guidanceId}
                          title="How did this guidance feel?"
                          description="Optional. Share what felt useful, generic, missing, or too heavy before you submit work."
                        />
                      ) : null}

                      <div className="border-t border-line pt-5">
                        <SubmissionSection
                          slot={slot}
                          isEvaluationPending={isEvaluationPending}
                          evaluationError={evaluationError}
                          isResubmitMode={isResubmitMode}
                          onSubmit={(text, kind, nextFilename) =>
                            void submitWork(milestone.id, text, kind, nextFilename)
                          }
                          onResubmit={() =>
                            setResubmitModeById((prev) => ({ ...prev, [milestone.id]: true }))
                          }
                          onCancelResubmit={() =>
                            setResubmitModeById((prev) => ({ ...prev, [milestone.id]: false }))
                          }
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function SubmissionSection({
  slot,
  isEvaluationPending,
  evaluationError,
  isResubmitMode,
  onSubmit,
  onResubmit,
  onCancelResubmit,
}: {
  slot: SubmissionSlot | undefined;
  isEvaluationPending: boolean;
  evaluationError: string | undefined;
  isResubmitMode: boolean;
  onSubmit: (text: string, kind: "pasted_text" | "file_upload", filename?: string) => void;
  onResubmit: () => void;
  onCancelResubmit: () => void;
}) {
  if (!slot || slot.status === "unloaded") return null;

  if (slot.status === "loading") {
    return (
      <div className="space-y-2">
        <p className="editorial-kicker">Submit your work</p>
        <p className="text-sm text-ink-muted">Loading your submission...</p>
      </div>
    );
  }

  if (slot.status === "completed") {
    return (
      <div className="space-y-4">
        {isResubmitMode ? (
          <>
            <ResubmitSummaryBar
              evaluation={slot.evaluation}
              createdAt={slot.submission.created_at}
              onCancel={onCancelResubmit}
            />
            <MilestoneSubmissionForm onSubmit={onSubmit} disabled={isEvaluationPending} />
            {evaluationError ? <Alert tone="danger">{evaluationError}</Alert> : null}
          </>
        ) : (
          <EvaluationResult
            submission={slot.submission}
            evaluationId={slot.evaluationId}
            evaluation={slot.evaluation}
            onResubmit={onResubmit}
          />
        )}
      </div>
    );
  }

  if (slot.status === "pending" || slot.status === "failed") {
    const fallbackEvaluation = getFallbackEvaluation(slot);

    return (
      <div className="space-y-4">
        {isResubmitMode ? (
          <>
            <SubmissionStateSummaryBar slot={slot} onCancel={onCancelResubmit} />
            <MilestoneSubmissionForm onSubmit={onSubmit} disabled={isEvaluationPending} />
            {evaluationError ? <Alert tone="danger">{evaluationError}</Alert> : null}
          </>
        ) : (
          <>
            <CurrentSubmissionStatusCard
              slot={slot}
              isEvaluationPending={isEvaluationPending}
              onResubmit={onResubmit}
            />
            {fallbackEvaluation ? (
              <EvaluationResult
                title="Last completed evaluation"
                note={
                  slot.status === "pending"
                    ? "Your newest submission is still pending, so Sevri is keeping the last completed evaluation visible."
                    : "Your newest submission failed to evaluate, so Sevri is keeping the last completed evaluation visible."
                }
                submission={fallbackEvaluation.submission}
                evaluationId={fallbackEvaluation.evaluation_id}
                evaluation={fallbackEvaluation.evaluation}
              />
            ) : null}
            {evaluationError ? <Alert tone="danger">{evaluationError}</Alert> : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="editorial-kicker">Submit your work</p>
        <p className="mt-1 text-sm text-ink-soft">
          Paste your work or upload a file to get an honest AI evaluation against the done-when criteria.
        </p>
      </div>
      <MilestoneSubmissionForm onSubmit={onSubmit} disabled={isEvaluationPending} />
      {evaluationError ? <Alert tone="danger">{evaluationError}</Alert> : null}
    </div>
  );
}

function MilestoneSubmissionForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (text: string, kind: "pasted_text" | "file_upload", filename?: string) => void;
  disabled: boolean;
}) {
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const combinedLength = fileContent
    ? fileContent.length + (pastedText ? NOTES_SEPARATOR.length + pastedText.length : 0)
    : pastedText.length;
  const hasContent = combinedLength > 0;
  const isOverLimit = combinedLength > MAX_SUBMISSION_CHARS;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      setFileContent(null);
      return;
    }

    setFile(selected);
    const reader = new FileReader();
    reader.onload = () => setFileContent(reader.result as string);
    reader.readAsText(selected);
  }

  function clearFile() {
    setFile(null);
    setFileContent(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit() {
    if (!hasContent || isOverLimit || disabled) return;

    if (fileContent && pastedText) {
      onSubmit(`${fileContent}${NOTES_SEPARATOR}${pastedText}`, "file_upload", file!.name);
    } else if (fileContent) {
      onSubmit(fileContent, "file_upload", file!.name);
    } else {
      onSubmit(pastedText, "pasted_text");
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Paste your code, research, or written work here..."
        value={pastedText}
        onChange={(e) => setPastedText(e.target.value)}
        disabled={disabled}
        rows={6}
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept={ACCEPTED_FILE_EXTENSIONS}
          onChange={handleFileChange}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          {file ? file.name : "Attach file"}
        </Button>
        {file ? (
          <button
            type="button"
            className="text-xs text-ink-muted hover:text-ink"
            onClick={clearFile}
            disabled={disabled}
          >
            Remove
          </button>
        ) : null}
      </div>

      {fileContent && pastedText ? (
        <p className="text-xs text-ink-muted">File content and notes will be sent together.</p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <span className={cn("text-xs", isOverLimit ? "font-medium text-red-600" : "text-ink-muted")}>
          {combinedLength.toLocaleString()} / {MAX_SUBMISSION_CHARS.toLocaleString()} characters
        </span>
        <Button
          type="button"
          size="sm"
          onClick={handleSubmit}
          disabled={!hasContent || isOverLimit || disabled}
        >
          {disabled ? "Evaluating..." : "Get evaluation"}
        </Button>
      </div>
    </div>
  );
}

function CurrentSubmissionStatusCard({
  slot,
  isEvaluationPending,
  onResubmit,
}: {
  slot: Extract<SubmissionSlot, { status: "pending" | "failed" }>;
  isEvaluationPending: boolean;
  onResubmit: () => void;
}) {
  const isFailed = slot.status === "failed";

  return (
    <Card tone="subtle" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="editorial-kicker">{isFailed ? "Evaluation failed" : "Evaluation pending"}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>{formatSubmissionKind(slot.submission.submission_kind, slot.submission.submission_filename)}</span>
            <span>&middot;</span>
            <span>{formatDate(slot.submission.created_at)}</span>
            <Badge tone={isFailed ? "danger" : "warning"} className="text-[10px]">
              {isFailed ? "Failed" : "Pending"}
            </Badge>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onResubmit} className="rounded-full">
          {isFailed ? "Submit new version" : "Submit another version"}
        </Button>
      </div>

      {isFailed ? (
        <Alert tone="danger">
          {slot.failureMessage ?? "The evaluation could not be completed, but your submission is still saved."}
        </Alert>
      ) : (
        <Alert tone="warning">
          {isEvaluationPending
            ? "Sevri is still processing this submission."
            : "This submission is saved, but its evaluation is still pending."}
        </Alert>
      )}
    </Card>
  );
}

function EvaluationResult({
  submission,
  evaluationId,
  evaluation,
  onResubmit,
  title = "Your evaluation",
  note,
}: {
  submission: StoredMilestoneSubmission;
  evaluationId?: string;
  evaluation: WorkEvaluation;
  onResubmit?: () => void;
  title?: string;
  note?: string;
}) {
  return (
    <Card tone="subtle" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="editorial-kicker">{title}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <span>{formatSubmissionKind(submission.submission_kind, submission.submission_filename)}</span>
            <span>&middot;</span>
            <span>{formatDate(submission.created_at)}</span>
            {evaluation.confidence ? (
              <>
                <span>&middot;</span>
                <Badge tone="neutral" className="text-[10px]">
                  {CONFIDENCE_LABEL[evaluation.confidence]}
                </Badge>
              </>
            ) : null}
          </div>
          {note ? <p className="text-xs text-ink-muted">{note}</p> : null}
        </div>
        {onResubmit ? (
          <Button type="button" variant="outline" size="sm" onClick={onResubmit} className="rounded-full">
            Submit new version
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Criterion verdicts</p>
        <ul className="space-y-2">
          {evaluation.criterion_verdicts.map((cv, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Badge tone={VERDICT_TONE[cv.verdict]} className="mt-0.5 shrink-0 text-[10px]">
                {VERDICT_LABEL[cv.verdict]}
              </Badge>
              <div>
                <span className="font-medium text-ink">{cv.criterion}</span>
                <span className="text-ink-soft"> - {cv.note}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Overall assessment</p>
        <p className="mt-1 text-sm leading-6 text-ink-soft">{evaluation.overall_assessment}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card tone="primary" padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Strongest aspect</p>
          <p className="mt-1 text-sm leading-6 text-ink">{evaluation.strongest_aspect}</p>
        </Card>
        <Card tone="default" padding="sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Clearest gap</p>
          <p className="mt-1 text-sm leading-6 text-ink">{evaluation.clearest_gap}</p>
        </Card>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Next best action</p>
        <p className="mt-1 text-sm leading-6 text-ink-soft">{evaluation.next_best_action}</p>
      </div>

      {evaluation.ready_to_mark_complete ? (
        <Alert tone="success">This step looks done. You can mark it complete above.</Alert>
      ) : (
        <p className="text-xs text-ink-muted">
          Not quite ready to mark complete - address the gaps above first.
        </p>
      )}

      {evaluationId ? (
        <GenerationFeedbackForm
          stage="work_evaluation"
          submissionEvaluationId={evaluationId}
          title="How did this evaluation feel?"
          description="Optional. This does not change the verdict. It only helps Sevri improve future coaching and review quality."
        />
      ) : null}
    </Card>
  );
}

function ResubmitSummaryBar({
  evaluation,
  createdAt,
  onCancel,
}: {
  evaluation: WorkEvaluation;
  createdAt: string;
  onCancel: () => void;
}) {
  const passCount = evaluation.criterion_verdicts.filter((v) => v.verdict === "pass").length;
  const totalCount = evaluation.criterion_verdicts.length;

  return (
    <Card tone="subtle" padding="sm" className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-ink">
          Last evaluation &middot; {formatDate(createdAt)}
        </p>
        <p className="text-xs text-ink-muted">
          {passCount} of {totalCount} criteria passed &middot;{" "}
          {evaluation.ready_to_mark_complete ? "Ready to mark complete" : "Not ready to mark complete"}
        </p>
        <p className="text-xs text-ink-muted">Your previous evaluation is saved.</p>
      </div>
      <button
        type="button"
        className="shrink-0 text-xs text-ink-muted hover:text-ink"
        onClick={onCancel}
      >
        Cancel
      </button>
    </Card>
  );
}

function SubmissionStateSummaryBar({
  slot,
  onCancel,
}: {
  slot: Extract<SubmissionSlot, { status: "pending" | "failed" }>;
  onCancel: () => void;
}) {
  return (
    <Card tone="subtle" padding="sm" className="flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-ink">
          Current submission &middot; {formatDate(slot.submission.created_at)}
        </p>
        <p className="text-xs text-ink-muted">
          {slot.status === "failed"
            ? "The latest evaluation failed, but this submission is still saved."
            : "The latest submission is still pending evaluation."}
        </p>
        <p className="text-xs text-ink-muted">
          Submitting again will create a new saved attempt.
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 text-xs text-ink-muted hover:text-ink"
        onClick={onCancel}
      >
        Cancel
      </button>
    </Card>
  );
}

function GuidanceBlock({
  title,
  tone = "default",
  children,
}: {
  title: string;
  tone?: "default" | "subtle" | "blush" | "primary" | "butter" | "contrast";
  children: ReactNode;
}) {
  return (
    <Card tone={tone} className="space-y-2" padding="md">
      <p className={cn("editorial-kicker", tone === "contrast" && "text-paper/55")}>{title}</p>
      {children}
    </Card>
  );
}

function normalizeGuidanceItem(item: string, variant: "bullet" | "ordered") {
  const trimmed = item.trim();
  if (variant !== "ordered") {
    return trimmed;
  }

  return trimmed.replace(/^(?:[-*]\s*)?(?:\d+[\.\)]\s*|step\s+\d+\s*[:.-]\s*)/i, "").trim();
}

function GuidanceList({
  items,
  variant = "bullet",
}: {
  items: string[];
  variant?: "bullet" | "ordered";
}) {
  if (variant === "ordered") {
    return (
      <ol className="space-y-3">
        {items.map((item, index) => {
          const displayItem = normalizeGuidanceItem(item, variant);
          return (
            <li key={`${item}-${index}`} className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
              <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-xs font-semibold text-ink">
                {index + 1}
              </span>
              <span>{displayItem}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ul className="space-y-2 text-sm leading-6 text-ink-soft">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>- {normalizeGuidanceItem(item, variant)}</li>
      ))}
    </ul>
  );
}
