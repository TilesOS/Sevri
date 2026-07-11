"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { roadmapStatusClassName } from "@/components/project/project-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GenerationFeedbackForm } from "@/components/shared/generation-feedback-form";
import { GithubStepCommits } from "@/components/project/github-step-commits";
import { Input } from "@/components/ui/input";
import { ReviewerFeedbackPanel } from "@/components/reviewer/reviewer-feedback-panel";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trackThemes } from "@/components/theme/theme-utils";
import { hasStepGuidanceAccess } from "@/lib/usage/limits";
import { safeRenderText } from "@/lib/ai/content-quality";
import {
  GUIDANCE_ENCOURAGEMENT_SPEC,
  GUIDANCE_WHAT_TO_DO_SPEC,
  STEP_OBJECTIVE_SPEC,
  STEP_TITLE_SPEC,
} from "@/lib/ai/content-quality-specs";
import type { ProjectMilestoneView, ProjectWorkspaceView } from "@/lib/projects/workspace";
import { getPinnedFocusStorageKey } from "@/lib/projects/focus-storage";
import type { MilestoneReviewRow } from "@/lib/db/queries/reviewers";
import type {
  LatestCompletedMilestoneEvaluation,
  MilestoneEvaluationResponse,
  Plan,
  StepGuidance,
  StoredMilestoneSubmission,
  WorkEvaluation,
} from "@/types/domain";

interface RouteErrorBody {
  error?: string;
  code?: "upgrade_required" | "previous_step_incomplete";
  feature?: "step_guidance";
  upgrade_url?: string;
  previous_step_number?: number;
}

interface GuidanceSlot {
  guidance: StepGuidance;
  guidanceId: string;
  checklistState: Record<string, boolean>;
}

interface GuidanceLockState {
  previousStepNumber: number | null;
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
const MAX_REBUTTAL_CHARS = 500;
const NOTES_SEPARATOR = "\n\n--- Notes ---\n\n";

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

type EvaluationHeadline = "Done" | "Drifted" | "Gap";

function getEvaluationHeadline(evaluation: WorkEvaluation): EvaluationHeadline {
  if (evaluation.ready_to_mark_complete) {
    return "Done";
  }

  if (evaluation.scope_assessment?.drifted) {
    return "Drifted";
  }

  return "Gap";
}

function getEvaluationFocus(evaluation: WorkEvaluation) {
  if (getEvaluationHeadline(evaluation) === "Drifted") {
    return evaluation.scope_assessment?.out_of_scope_note ?? evaluation.next_best_action;
  }

  return evaluation.next_best_action;
}

function buildRebuttalSubmission(submission: StoredMilestoneSubmission, rebuttal: string) {
  return [
    `Student rebuttal to the prior evaluation: ${rebuttal.trim()}`,
    "Original submission:",
    submission.submission_text,
  ].join("\n\n");
}

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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatSubmissionKind(kind: string, filename: string | null) {
  if (kind === "pasted_text") return "Pasted text";
  if (filename) return `File: ${filename}`;
  return "File upload";
}

function normalizeGuidanceItem(item: string, variant: "bullet" | "ordered") {
  const trimmed = item.trim();
  if (variant !== "ordered") {
    return trimmed;
  }

  return trimmed.replace(/^(?:[-*]\s*)?(?:\d+[\.\)]\s*|step\s+\d+\s*[:.-]\s*)/i, "").trim();
}

function getGuidanceLockMessage(previousStepNumber: number | null) {
  if (previousStepNumber) {
    return `Finish Step ${previousStepNumber} before opening guidance for this step.`;
  }

  return "Finish the previous step before opening guidance for this step.";
}

function getSubmissionLockMessage(previousStepNumber: number | null) {
  if (previousStepNumber) {
    return `Detailed feedback unlocks after Step ${previousStepNumber} is complete.`;
  }

  return "Detailed feedback unlocks once the previous step is complete.";
}

export function ProjectStepWorkspace({
  workspace,
  milestone,
  plan,
  reviews,
}: {
  workspace: ProjectWorkspaceView;
  milestone: ProjectMilestoneView;
  plan: Plan;
  reviews: MilestoneReviewRow[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returningFromFocus = searchParams.get("from") === "focus";
  const hasDetailAccess = hasStepGuidanceAccess(plan);
  const trackTheme = trackThemes[workspace.projectTrack];
  const [guidanceSlot, setGuidanceSlot] = useState<GuidanceSlot | null>(null);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);
  const [guidanceLock, setGuidanceLock] = useState<GuidanceLockState | null>(
    milestone.guidanceLocked ? { previousStepNumber: milestone.previousStepNumber } : null,
  );
  const [isGuidancePending, setIsGuidancePending] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [submissionSlot, setSubmissionSlot] = useState<SubmissionSlot>({ status: "unloaded" });
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [isEvaluationPending, setIsEvaluationPending] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isResubmitMode, setIsResubmitMode] = useState(false);
  const [currentFocus, setCurrentFocus] = useState<string | null>(null);
  const [isCompletionPending, setIsCompletionPending] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const fetchGuidanceRef = useRef(fetchGuidance);
  const loadSubmissionRef = useRef(loadSubmission);
  const checklistSaveStateRef = useRef<{
    inFlight: boolean;
    pending: Record<number, boolean> | null;
  }>({ inFlight: false, pending: null });
  const isGuidanceLocked = guidanceLock !== null;
  const guidanceLockMessage = getGuidanceLockMessage(guidanceLock?.previousStepNumber ?? milestone.previousStepNumber);
  const submissionLockMessage = getSubmissionLockMessage(guidanceLock?.previousStepNumber ?? milestone.previousStepNumber);

  useEffect(() => {
    setGuidanceSlot(null);
    setGuidanceError(null);
    setGuidanceLock(milestone.guidanceLocked ? { previousStepNumber: milestone.previousStepNumber } : null);
    setSubmissionSlot({ status: "unloaded" });
    setEvaluationError(null);
    setIsComposerOpen(false);
    setIsResubmitMode(false);
    setCurrentFocus(null);
    setCheckedItems({});

    if (!hasDetailAccess) {
      return;
    }

    if (!milestone.guidanceLocked) {
      void fetchGuidanceRef.current();
    }

    void loadSubmissionRef.current();
  }, [hasDetailAccess, milestone.guidanceLocked, milestone.id, milestone.previousStepNumber]);

  useEffect(() => {
    const pinnedFocus = window.sessionStorage.getItem(
      getPinnedFocusStorageKey(workspace.project.id, milestone.id),
    );
    if (pinnedFocus?.trim()) {
      setCurrentFocus(pinnedFocus.trim());
    }

    if (returningFromFocus) {
      setIsComposerOpen(true);
      setIsResubmitMode(false);
    }
  }, [milestone.id, returningFromFocus, workspace.project.id]);

  useEffect(() => {
    if (!guidanceSlot) {
      setCheckedItems({});
      return;
    }

    setCheckedItems(
      guidanceSlot.guidance.checklist.reduce<Record<number, boolean>>((accumulator, _item, index) => {
        accumulator[index] = Boolean(guidanceSlot.checklistState[String(index)]);
        return accumulator;
      }, {}),
    );
  }, [guidanceSlot]);

  function persistChecklistState(next: Record<number, boolean>) {
    // Coalesce concurrent toggles: a save in flight defers the newest state
    // until it returns, so a stale earlier request can't overwrite a newer one.
    const state = checklistSaveStateRef.current;
    state.pending = next;

    if (state.inFlight) {
      return;
    }

    void sendNextChecklistSave();
  }

  async function sendNextChecklistSave() {
    const state = checklistSaveStateRef.current;
    if (state.pending === null) {
      return;
    }

    state.inFlight = true;

    while (state.pending !== null) {
      const snapshot = state.pending;
      state.pending = null;

      const payload: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(snapshot)) {
        payload[key] = Boolean(value);
      }

      try {
        await fetch(`/api/ai/milestones/${milestone.id}/guidance/checklist`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: payload }),
        });
      } catch {
        // Non-blocking — the UI keeps the optimistic toggle. The next page load will
        // resync from the server if the save genuinely failed.
      }
    }

    state.inFlight = false;
  }

  async function toggleMilestone() {
    setIsCompletionPending(true);
    setToggleError(null);

    const response = await fetch(`/api/milestones/${milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !milestone.completed }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setToggleError(body?.error ?? "Failed to update milestone.");
      setIsCompletionPending(false);
      return;
    }

    setIsCompletionPending(false);
    router.refresh();
  }

  async function fetchGuidance(refresh = false) {
    if (milestone.guidanceLocked) {
      setGuidanceLock({ previousStepNumber: milestone.previousStepNumber });
      return;
    }

    setIsGuidancePending(true);
    setGuidanceError(null);

    const response = await fetch(`/api/ai/milestones/${milestone.id}/guidance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    const body = (await response.json().catch(() => null)) as
      | ({
          guidance?: StepGuidance;
          milestone_guidance_id?: string;
          checklist_state?: Record<string, boolean>;
        } & RouteErrorBody)
      | null;

    if (body?.code === "previous_step_incomplete") {
      setGuidanceSlot(null);
      setGuidanceLock({ previousStepNumber: body.previous_step_number ?? milestone.previousStepNumber });
      setGuidanceError(null);
      setIsGuidancePending(false);
      return;
    }

    if (!response.ok || !body?.guidance || !body.milestone_guidance_id) {
      setGuidanceLock(null);
      setGuidanceError(body?.error ?? "Failed to load step guidance.");
      setIsGuidancePending(false);
      return;
    }

    setGuidanceLock(null);
    setGuidanceSlot({
      guidance: body.guidance,
      guidanceId: body.milestone_guidance_id,
      checklistState: body.checklist_state ?? {},
    });
    setIsGuidancePending(false);
  }

  async function fetchSubmissionState() {
    const response = await fetch(`/api/ai/milestones/${milestone.id}/evaluate`);
    const body = (await response.json().catch(() => null)) as (MilestoneEvaluationResponse & RouteErrorBody) | null;

    if (!response.ok || !body) {
      throw new Error(body?.error ?? "Failed to load saved evaluation.");
    }

    return body;
  }

  async function loadSubmission() {
    setSubmissionSlot({ status: "loading" });
    setEvaluationError(null);

    try {
      const body = await fetchSubmissionState();
      setSubmissionSlot(buildSubmissionSlot(body));
    } catch {
      setSubmissionSlot({ status: "empty" });
      setEvaluationError("Network error. Failed to load saved evaluation.");
    }
  }

  fetchGuidanceRef.current = fetchGuidance;
  loadSubmissionRef.current = loadSubmission;

  async function submitWork(text: string, kind: "pasted_text" | "file_upload", filename?: string) {
    setIsEvaluationPending(true);
    setEvaluationError(null);

    try {
      const response = await fetch(`/api/ai/milestones/${milestone.id}/evaluate`, {
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
        setEvaluationError(body?.error ?? "Failed to save your submission.");
        try {
          const recovered = await fetchSubmissionState();
          setSubmissionSlot(buildSubmissionSlot(recovered));
        } catch {
          // Keep the prior submission state if recovery fails.
        }
        setIsEvaluationPending(false);
        return;
      }

      setSubmissionSlot(buildSubmissionSlot(body));
      setIsComposerOpen(false);
      setIsResubmitMode(false);
    } catch {
      try {
        const recovered = await fetchSubmissionState();
        setSubmissionSlot(buildSubmissionSlot(recovered));
        setEvaluationError(null);
        setIsComposerOpen(false);
        setIsResubmitMode(false);
      } catch {
        setEvaluationError("Network error. Your submission may have been saved - refresh and try again.");
      }
    }

    setIsEvaluationPending(false);
  }

  function pinCurrentFocus(focus: string) {
    setCurrentFocus(focus);
    window.sessionStorage.setItem(
      getPinnedFocusStorageKey(workspace.project.id, milestone.id),
      focus,
    );
  }

  const fallbackEvaluation = getFallbackEvaluation(submissionSlot);
  const currentChecklistIndex =
    guidanceSlot?.guidance.checklist.findIndex((_item, index) => !checkedItems[index]) ?? -1;

  return (
    <div className="space-y-8 pb-52">
      {currentFocus ? (
        <div className="sticky top-3 z-30 rounded-2xl border border-primary/35 bg-paper/95 px-4 py-3 shadow-soft backdrop-blur">
          <p className="text-sm text-ink">
            <span className="mr-2 font-semibold">Current focus:</span>
            {currentFocus}
          </p>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button
          href={`/projects/${workspace.project.id}/focus?milestone=${encodeURIComponent(milestone.id)}`}
          size="lg"
          className="px-7"
        >
          Start focus block
        </Button>
      </div>

      <Card tone="contrast" className="aurora-fallback border-contrast-line" elevation="lifted">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={trackTheme.badgeTone}>{trackTheme.label}</Badge>
            <Badge tone={milestone.completed ? "success" : "warning"}>
              {milestone.completed ? "Complete" : milestone.status === "in_progress" ? "In progress" : "Not started"}
            </Badge>
          </div>
          <div>
            <h1 className="font-display text-4xl leading-none text-paper sm:text-5xl">
              {safeRenderText(milestone.title, STEP_TITLE_SPEC).text}
            </h1>
          </div>
        </div>
      </Card>

      <StepTimeline milestones={workspace.milestones} projectId={workspace.project.id} activeStepNumber={milestone.stepNumber} />

      {toggleError ? <Alert tone="danger">{toggleError}</Alert> : null}

      {workspace.projectTrack === "software" && workspace.githubLink?.status === "active" ? (
        <GithubStepCommits projectId={workspace.project.id} milestoneId={milestone.id} />
      ) : null}

      <Card className="space-y-4">
        <p className="editorial-kicker">Step objective</p>
        <p className="text-sm leading-6 text-ink-soft">
          {safeRenderText(milestone.objective, STEP_OBJECTIVE_SPEC).text}
        </p>
        <Button
          type="button"
          variant={milestone.completed ? "outline" : "primary"}
          onClick={() => void toggleMilestone()}
          disabled={isCompletionPending}
          className="rounded-full"
        >
          {isCompletionPending
            ? "Saving..."
            : milestone.completed
              ? "Mark as not complete"
              : "Mark step complete"}
        </Button>
      </Card>

      {!hasDetailAccess ? (
        <Card className="space-y-4">
          <p className="editorial-kicker">Premium step coaching</p>
          <h2 className="text-2xl font-semibold text-ink">Upgrade to unlock detailed step guidance and work evaluation.</h2>
          <p className="text-sm leading-6 text-ink-soft">
            Free keeps the roadmap, project pages, and each step objective visible so you can try one software project and one research project. Pro adds the full coaching experience for each step, including detailed guidance, done-when review, and AI evaluation of your work.
          </p>
          <div>
            <Button href="/settings/billing" className="rounded-full px-6">
              Upgrade to Pro
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {!isGuidanceLocked && guidanceError ? <Alert tone="danger">{guidanceError}</Alert> : null}

          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="editorial-kicker">Step guidance</p>
              {isGuidanceLocked ? (
                <Badge tone="warning">Locked</Badge>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void fetchGuidance(true)}
                  disabled={isGuidancePending}
                  className="rounded-full"
                >
                  {isGuidancePending ? "Refreshing..." : "Refresh guidance"}
                </Button>
              )}
            </div>

            {isGuidanceLocked ? (
              <Alert tone="warning" heading="Guidance unlocks step by step">
                {guidanceLockMessage}
              </Alert>
            ) : guidanceSlot ? (
              <>
                <Card className="space-y-4 bg-surface-mint" elevation="soft">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="editorial-kicker">Checklist</p>
                    <Button
                      href={`/projects/${workspace.project.id}/focus?milestone=${encodeURIComponent(milestone.id)}`}
                      size="sm"
                    >
                      Start focus block
                    </Button>
                  </div>
                  <p className="text-sm leading-6 text-ink-soft">
                    {safeRenderText(guidanceSlot.guidance.what_to_do_now, GUIDANCE_WHAT_TO_DO_SPEC).text}
                  </p>
                  <ol className="space-y-3">
                    {guidanceSlot.guidance.checklist.map((item, index) => {
                      const isCurrentTask = index === currentChecklistIndex;
                      return (
                        <li
                          key={`${item}-${index}`}
                          className={cn(
                            "rounded-2xl border bg-paper/70 px-4 py-3",
                            isCurrentTask ? "border-primary/60 shadow-soft" : "border-transparent",
                          )}
                        >
                          {isCurrentTask ? (
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                              Current task
                            </p>
                          ) : null}
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-line"
                              style={{ accentColor: "var(--yellow)" }}
                              checked={checkedItems[index] ?? false}
                              onChange={() =>
                                setCheckedItems((current) => {
                                  const next = { ...current, [index]: !current[index] };
                                  persistChecklistState(next);
                                  return next;
                                })
                              }
                            />
                            <span className={cn("text-sm leading-6", isCurrentTask ? "font-semibold text-ink" : "text-ink-soft")}>
                              {normalizeGuidanceItem(item, "ordered")}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ol>
                </Card>

                <details className="group rounded-2xl border border-line bg-paper px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    Show step detail
                    <span className="text-xs text-ink-muted transition group-open:rotate-180">▾</span>
                  </summary>
                  <div className="mt-5 space-y-5 border-t border-line pt-5">
                    <div>
                      <p className="editorial-kicker">Coaching note</p>
                      <p className="mt-2 text-sm leading-6 text-ink-soft">
                        {safeRenderText(guidanceSlot.guidance.encouragement, GUIDANCE_ENCOURAGEMENT_SPEC).text}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <p className="editorial-kicker">Watch out</p>
                      <GuidanceList items={guidanceSlot.guidance.pitfalls} />
                    </div>
                    <div className="space-y-3">
                      <p className="editorial-kicker">Tools / resources</p>
                      <GuidanceList items={guidanceSlot.guidance.tools_resources} />
                    </div>
                    <GenerationFeedbackForm
                      variant="compact"
                      stage="step_guidance"
                      milestoneGuidanceId={guidanceSlot.guidanceId}
                      title="How is this coaching?"
                      description="Optional. Share what feels useful, too heavy, or missing."
                    />
                  </div>
                </details>
              </>
            ) : (
              <p className="text-sm leading-6 text-ink-soft">
                {isGuidancePending ? "Loading step guidance..." : "Open guidance to load the current coaching for this step."}
              </p>
            )}
          </Card>

          <div className="space-y-4" id="submission-area">
            {guidanceSlot ? (
              <Card padding="sm" className="space-y-3">
                <p className="editorial-kicker">Done when</p>
                <GuidanceList items={guidanceSlot.guidance.done_when} />
              </Card>
            ) : null}

            {isGuidanceLocked ? (
              <Alert tone="warning" heading="Feedback stays focused, too">
                {submissionLockMessage}
              </Alert>
            ) : null}

            <SubmissionSummary
              slot={submissionSlot}
              evaluationError={evaluationError}
              isEvaluationPending={isEvaluationPending}
              isCompletionPending={isCompletionPending}
              isMilestoneComplete={milestone.completed}
              actionsDisabled={isGuidanceLocked}
              onOpenComposer={() => {
                setIsComposerOpen(true);
                setIsResubmitMode(true);
              }}
              onPinFocus={pinCurrentFocus}
              onMarkDone={() => {
                if (!milestone.completed) {
                  void toggleMilestone();
                }
              }}
              onRebuttal={(submission, rebuttal) =>
                void submitWork(
                  buildRebuttalSubmission(submission, rebuttal),
                  submission.submission_kind,
                  submission.submission_filename ?? undefined,
                )
              }
            />

            {fallbackEvaluation ? (
              <EvaluationResult
                note={
                  submissionSlot.status === "pending"
                    ? "Previous verdict shown while the newest submission is evaluated."
                    : "Previous verdict shown because the newest evaluation failed."
                }
                submission={fallbackEvaluation.submission}
                evaluation={fallbackEvaluation.evaluation}
                actionsDisabled={isGuidanceLocked}
                isActionPending={isEvaluationPending || isCompletionPending}
                isMilestoneComplete={milestone.completed}
                onPinFocus={pinCurrentFocus}
                onMarkDone={() => {
                  if (!milestone.completed) {
                    void toggleMilestone();
                  }
                }}
                onRebuttal={(submission, rebuttal) =>
                  void submitWork(
                    buildRebuttalSubmission(submission, rebuttal),
                    submission.submission_kind,
                    submission.submission_filename ?? undefined,
                  )
                }
              />
            ) : null}

            <ReviewerFeedbackPanel reviews={reviews} />
          </div>

          <SubmissionDock
            slot={submissionSlot}
            isOpen={isComposerOpen}
            isPending={isEvaluationPending}
            isResubmitMode={isResubmitMode}
            onToggle={() => setIsComposerOpen((current) => !current)}
            onResubmit={() => {
              setIsComposerOpen(true);
              setIsResubmitMode(true);
            }}
            onCancel={() => {
              setIsComposerOpen(false);
              setIsResubmitMode(false);
            }}
            onSubmit={(text, kind, filename) => void submitWork(text, kind, filename)}
            evaluationError={evaluationError}
            actionsDisabled={isGuidanceLocked}
            lockedMessage={submissionLockMessage}
            projectId={workspace.project.id}
            milestoneId={milestone.id}
            githubImportEnabled={
              workspace.projectTrack === "software" && workspace.githubLink?.status === "active"
            }
            autoImportFromGithub={
              returningFromFocus &&
              workspace.projectTrack === "software" &&
              workspace.githubLink?.status === "active"
            }
          />
        </>
      )}
    </div>
  );
}

function StepTimeline({
  milestones,
  projectId,
  activeStepNumber,
}: {
  milestones: ProjectMilestoneView[];
  projectId: string;
  activeStepNumber: number;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-3">
        {milestones.map((item) => {
          const isActive = item.stepNumber === activeStepNumber;

          return (
            <Link
              key={item.id}
              href={`/project/${projectId}/steps/${item.stepNumber}`}
              style={isActive ? { borderTop: '3px solid var(--yellow)' } : undefined}
              className={cn(
                "min-w-[11rem] rounded-2xl border px-4 py-3 transition",
                isActive ? "muted-toggle-surface-active" : "muted-toggle-surface",
                item.isFuture && !isActive && "opacity-70",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Step {item.stepNumber}</p>
                  <p className="mt-2 text-sm font-semibold text-current">{item.title}</p>
                </div>
                <span
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-full", roadmapStatusClassName[item.status])}
                  aria-hidden="true"
                />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SubmissionSummary({
  slot,
  evaluationError,
  isEvaluationPending,
  isCompletionPending,
  isMilestoneComplete,
  actionsDisabled,
  onOpenComposer,
  onPinFocus,
  onMarkDone,
  onRebuttal,
}: {
  slot: SubmissionSlot;
  evaluationError: string | null;
  isEvaluationPending: boolean;
  isCompletionPending: boolean;
  isMilestoneComplete: boolean;
  actionsDisabled: boolean;
  onOpenComposer: () => void;
  onPinFocus: (focus: string) => void;
  onMarkDone: () => void;
  onRebuttal: (submission: StoredMilestoneSubmission, rebuttal: string) => void;
}) {
  if (slot.status === "unloaded" || slot.status === "loading" || slot.status === "empty") {
    return (
      <Card className="space-y-3">
        <p className="editorial-kicker">Submission</p>
        <p className="text-sm leading-6 text-ink-soft">
          Submit work from the bottom action bar when you are ready for a review.
        </p>
        {evaluationError ? <Alert tone="danger">{evaluationError}</Alert> : null}
      </Card>
    );
  }

  if (slot.status === "completed") {
    return (
      <EvaluationResult
        submission={slot.submission}
        evaluation={slot.evaluation}
        actionsDisabled={actionsDisabled}
        isActionPending={isEvaluationPending || isCompletionPending}
        isMilestoneComplete={isMilestoneComplete}
        onPinFocus={onPinFocus}
        onMarkDone={onMarkDone}
        onRebuttal={onRebuttal}
      />
    );
  }

  return (
    <CurrentSubmissionStatusCard
      slot={slot}
      isEvaluationPending={isEvaluationPending}
      actionsDisabled={actionsDisabled}
      onResubmit={onOpenComposer}
      evaluationError={evaluationError}
    />
  );
}

function SubmissionDock({
  slot,
  isOpen,
  isPending,
  isResubmitMode,
  onToggle,
  onResubmit,
  onCancel,
  onSubmit,
  evaluationError,
  actionsDisabled,
  lockedMessage,
  projectId,
  milestoneId,
  githubImportEnabled,
  autoImportFromGithub,
}: {
  slot: SubmissionSlot;
  isOpen: boolean;
  isPending: boolean;
  isResubmitMode: boolean;
  onToggle: () => void;
  onResubmit: () => void;
  onCancel: () => void;
  onSubmit: (text: string, kind: "pasted_text" | "file_upload", filename?: string) => void;
  evaluationError: string | null;
  actionsDisabled: boolean;
  lockedMessage: string;
  projectId: string;
  milestoneId: string;
  githubImportEnabled: boolean;
  autoImportFromGithub: boolean;
}) {
  const summary = getSubmissionDockSummary(slot, isPending, actionsDisabled, lockedMessage);

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 lg:left-auto lg:w-[min(42rem,calc(100vw-19rem))] lg:right-8">
      {isOpen && !actionsDisabled ? (
        <Card className="mb-3 space-y-4 border-line-strong bg-paper/98 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="editorial-kicker">{isResubmitMode ? "Submit another version" : "Submit your work"}</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                Paste your work or upload a file to get an honest evaluation against this step&apos;s acceptance criteria.
              </p>
            </div>
            <button type="button" className="text-sm text-ink-muted hover:text-ink" onClick={onCancel}>
              Close
            </button>
          </div>

          <MilestoneSubmissionForm
            onSubmit={onSubmit}
            disabled={isPending}
            projectId={projectId}
            milestoneId={milestoneId}
            githubImportEnabled={githubImportEnabled}
            autoImportFromGithub={autoImportFromGithub}
          />
          {evaluationError ? <Alert tone="danger">{evaluationError}</Alert> : null}
        </Card>
      ) : null}

      <Card className="border-line-strong bg-paper/98 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{summary.title}</p>
            <p className="truncate text-xs text-ink-muted">{summary.description}</p>
          </div>
          <div className="flex items-center gap-2">
            {slot.status !== "empty" && slot.status !== "unloaded" && slot.status !== "loading" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={onResubmit}
                disabled={actionsDisabled}
              >
                Resubmit
              </Button>
            ) : null}
            <Button type="button" size="sm" className="rounded-full" onClick={onToggle} disabled={actionsDisabled}>
              {isOpen ? "Hide form" : slot.status === "completed" ? "Submit new version" : "Submit work"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function getSubmissionDockSummary(
  slot: SubmissionSlot,
  isPending: boolean,
  actionsDisabled: boolean,
  lockedMessage: string,
) {
  if (actionsDisabled) {
    return {
      title: "Feedback unlocks one step at a time",
      description: lockedMessage,
    };
  }

  if (slot.status === "completed") {
    const headline = getEvaluationHeadline(slot.evaluation);
    return {
      title: `${headline} verdict`,
      description:
        headline === "Done"
          ? "Every done-when criterion is met."
          : headline === "Drifted"
            ? slot.evaluation.scope_assessment?.out_of_scope_note ?? "Cut or park the out-of-scope work."
            : slot.evaluation.clearest_gap,
    };
  }

  if (slot.status === "pending") {
    return {
      title: "Evaluation pending",
      description: isPending
        ? "Sevri is processing the newest submission."
        : "Your latest submission is saved and waiting for evaluation.",
    };
  }

  if (slot.status === "failed") {
    return {
      title: "Evaluation needs another try",
      description: slot.failureMessage ?? "Your work is saved, but the evaluation failed.",
    };
  }

  return {
    title: "Ready when you are",
    description: "Open the submission panel whenever you want feedback on this step.",
  };
}

function MilestoneSubmissionForm({
  onSubmit,
  disabled,
  projectId,
  milestoneId,
  githubImportEnabled,
  autoImportFromGithub,
}: {
  onSubmit: (text: string, kind: "pasted_text" | "file_upload", filename?: string) => void;
  disabled: boolean;
  projectId: string;
  milestoneId: string;
  githubImportEnabled: boolean;
  autoImportFromGithub: boolean;
}) {
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importInfo, setImportInfo] = useState<string | null>(null);
  const autoImportStartedRef = useRef(false);

  const handleGithubImport = useCallback(async () => {
    setIsImporting(true);
    setImportError(null);
    setImportInfo(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/github/submission-import?milestone_id=${encodeURIComponent(milestoneId)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        setImportError(body.error ?? body.code ?? "Could not import commits.");
        return;
      }
      const body = (await res.json()) as {
        content: string;
        commit_count: number;
        truncated: boolean;
      };
      if (body.commit_count === 0) {
        setImportInfo("No commits attributed to this step yet.");
        return;
      }
      setPastedText((current) =>
        current ? `${current}\n\n${body.content}` : body.content,
      );
      setImportInfo(
        body.truncated
          ? `Imported ${body.commit_count} commits (truncated to fit).`
          : `Imported ${body.commit_count} commits.`,
      );
    } catch {
      setImportError("Network error. Please try again.");
    } finally {
      setIsImporting(false);
    }
  }, [milestoneId, projectId]);

  useEffect(() => {
    if (!autoImportFromGithub || !githubImportEnabled || autoImportStartedRef.current) {
      return;
    }

    autoImportStartedRef.current = true;
    void handleGithubImport();
  }, [autoImportFromGithub, githubImportEnabled, handleGithubImport]);

  const combinedLength = fileContent
    ? fileContent.length + (pastedText ? NOTES_SEPARATOR.length + pastedText.length : 0)
    : pastedText.length;
  const hasContent = combinedLength > 0;
  const isOverLimit = combinedLength > MAX_SUBMISSION_CHARS;

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSubmit() {
    if (!hasContent || isOverLimit || disabled) {
      return;
    }

    if (fileContent && pastedText) {
      onSubmit(`${fileContent}${NOTES_SEPARATOR}${pastedText}`, "file_upload", file!.name);
      return;
    }

    if (fileContent) {
      onSubmit(fileContent, "file_upload", file!.name);
      return;
    }

    onSubmit(pastedText, "pasted_text");
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Paste your code, research, writing, or notes here..."
        value={pastedText}
        onChange={(event) => setPastedText(event.target.value)}
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
          <button type="button" className="text-xs text-ink-muted hover:text-ink" onClick={clearFile} disabled={disabled}>
            Remove
          </button>
        ) : null}
        {githubImportEnabled ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleGithubImport()}
            disabled={disabled || isImporting}
          >
            {isImporting ? "Importing…" : "Import from GitHub"}
          </Button>
        ) : null}
      </div>

      {importError ? <p className="text-xs text-red-600">{importError}</p> : null}
      {importInfo ? <p className="text-xs text-ink-muted">{importInfo}</p> : null}

      {fileContent && pastedText ? (
        <p className="text-xs text-ink-muted">File content and notes will be sent together.</p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <span className={cn("text-xs", isOverLimit ? "font-medium text-red-600" : "text-ink-muted")}>
          {combinedLength.toLocaleString()} / {MAX_SUBMISSION_CHARS.toLocaleString()} characters
        </span>
        <Button type="button" size="sm" onClick={handleSubmit} disabled={!hasContent || isOverLimit || disabled}>
          {disabled ? "Evaluating..." : "Get evaluation"}
        </Button>
      </div>
    </div>
  );
}

function CurrentSubmissionStatusCard({
  slot,
  isEvaluationPending,
  actionsDisabled,
  onResubmit,
  evaluationError,
}: {
  slot: Extract<SubmissionSlot, { status: "pending" | "failed" }>;
  isEvaluationPending: boolean;
  actionsDisabled: boolean;
  onResubmit: () => void;
  evaluationError: string | null;
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onResubmit}
          className="rounded-full"
          disabled={actionsDisabled}
        >
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

      {evaluationError ? <Alert tone="danger">{evaluationError}</Alert> : null}
    </Card>
  );
}

function EvaluationResult({
  submission,
  evaluation,
  actionsDisabled = false,
  isActionPending,
  isMilestoneComplete,
  onPinFocus,
  onMarkDone,
  onRebuttal,
  note,
}: {
  submission: StoredMilestoneSubmission;
  evaluation: WorkEvaluation;
  actionsDisabled?: boolean;
  isActionPending: boolean;
  isMilestoneComplete: boolean;
  onPinFocus: (focus: string) => void;
  onMarkDone: () => void;
  onRebuttal: (submission: StoredMilestoneSubmission, rebuttal: string) => void;
  note?: string;
}) {
  const [isRebuttalOpen, setIsRebuttalOpen] = useState(false);
  const [rebuttal, setRebuttal] = useState("");
  const headline = getEvaluationHeadline(evaluation);
  const focus = getEvaluationFocus(evaluation);
  const detail =
    headline === "Done"
      ? "Every done-when criterion is met."
      : headline === "Drifted"
        ? evaluation.scope_assessment?.out_of_scope_note ?? "Cut or park the out-of-scope work before continuing."
        : evaluation.clearest_gap;
  const tone = headline === "Done" ? "success" : headline === "Drifted" ? "warning" : "danger";
  const controlsDisabled = actionsDisabled || isActionPending;

  function submitRebuttal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = rebuttal.trim();
    if (!trimmed || controlsDisabled) {
      return;
    }

    setIsRebuttalOpen(false);
    setRebuttal("");
    onRebuttal(submission, trimmed);
  }

  return (
    <Card tone="subtle" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="editorial-kicker">Work verdict</p>
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
        <Badge tone={tone}>{headline}</Badge>
      </div>

      <Alert tone={tone} heading={headline}>
        {detail}
      </Alert>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Done-when checklist</p>
        <ul className="space-y-3">
          {evaluation.criterion_verdicts.map((verdict, index) => (
            <li key={`${verdict.criterion}-${index}`} className="flex items-start gap-2 text-sm">
              {verdict.verdict === "met" || verdict.verdict === "pass" ? (
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700"
                  aria-label="Met"
                >
                  &#10003;
                </span>
              ) : (
                <span
                  className="mt-0.5 h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-ink-muted/60"
                  aria-label="Not yet"
                />
              )}
              <div className="space-y-0.5">
                <p className="font-medium text-ink">{verdict.criterion}</p>
                <p className="text-ink-soft">{verdict.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="button" onClick={() => onPinFocus(focus)} disabled={controlsDisabled}>
          Make this my next block
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onMarkDone}
          disabled={controlsDisabled || isMilestoneComplete}
        >
          Mark done anyway
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setIsRebuttalOpen(true)}
          disabled={controlsDisabled || isRebuttalOpen}
        >
          I disagree
        </Button>
      </div>

      {isRebuttalOpen ? (
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitRebuttal}>
          <Input
            type="text"
            value={rebuttal}
            onChange={(event) => setRebuttal(event.target.value)}
            placeholder="Briefly say what the evaluation missed"
            maxLength={MAX_REBUTTAL_CHARS}
            aria-label="Evaluation rebuttal"
            autoFocus
            disabled={controlsDisabled}
          />
          <Button type="submit" size="sm" disabled={controlsDisabled || !rebuttal.trim()}>
            Submit
          </Button>
        </form>
      ) : null}
    </Card>
  );
}

function GuidanceList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3 text-sm leading-6 text-ink-soft">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-2xl bg-canvas px-4 py-3">
          {normalizeGuidanceItem(item, "bullet")}
        </li>
      ))}
    </ul>
  );
}
