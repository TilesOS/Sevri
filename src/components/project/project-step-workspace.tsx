"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { roadmapStatusClassName } from "@/components/project/project-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GenerationFeedbackForm } from "@/components/shared/generation-feedback-form";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getPlanLabel, trackThemes } from "@/components/theme/theme-utils";
import { hasStepGuidanceAccess } from "@/lib/usage/limits";
import type { ProjectMilestoneView, ProjectWorkspaceView } from "@/lib/projects/workspace";
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
}

interface GuidanceLockState {
  previousStepNumber: number | null;
}

type GuidanceTab = "checklist" | "pitfalls" | "tools" | "done_when";

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
}: {
  workspace: ProjectWorkspaceView;
  milestone: ProjectMilestoneView;
  plan: Plan;
}) {
  const router = useRouter();
  const hasDetailAccess = hasStepGuidanceAccess(plan);
  const trackTheme = trackThemes[workspace.projectTrack];
  const [guidanceSlot, setGuidanceSlot] = useState<GuidanceSlot | null>(null);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);
  const [guidanceLock, setGuidanceLock] = useState<GuidanceLockState | null>(
    milestone.guidanceLocked ? { previousStepNumber: milestone.previousStepNumber } : null,
  );
  const [isGuidancePending, setIsGuidancePending] = useState(false);
  const [activeTab, setActiveTab] = useState<GuidanceTab>("checklist");
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [submissionSlot, setSubmissionSlot] = useState<SubmissionSlot>({ status: "unloaded" });
  const [evaluationError, setEvaluationError] = useState<string | null>(null);
  const [isEvaluationPending, setIsEvaluationPending] = useState(false);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isResubmitMode, setIsResubmitMode] = useState(false);
  const [isCompletionPending, setIsCompletionPending] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const fetchGuidanceRef = useRef(fetchGuidance);
  const loadSubmissionRef = useRef(loadSubmission);
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
    setActiveTab("checklist");
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
    if (!guidanceSlot) {
      setCheckedItems({});
      return;
    }

    setCheckedItems(
      guidanceSlot.guidance.checklist.reduce<Record<number, boolean>>((accumulator, _item, index) => {
        accumulator[index] = false;
        return accumulator;
      }, {}),
    );
  }, [guidanceSlot]);

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
      | ({ guidance?: StepGuidance; milestone_guidance_id?: string } & RouteErrorBody)
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

  const fallbackEvaluation = getFallbackEvaluation(submissionSlot);

  return (
    <div className="space-y-8 pb-52">
      <Card tone="contrast" className="border-contrast-line">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="contrast">{getPlanLabel(plan)}</Badge>
            <Badge tone={trackTheme.badgeTone}>{trackTheme.label}</Badge>
            <Badge tone={milestone.completed ? "success" : "warning"}>
              {milestone.completed ? "Complete" : milestone.status === "in_progress" ? "In progress" : "Not started"}
            </Badge>
          </div>
          <div className="space-y-3">
            <p className="editorial-kicker text-paper/55">Focused step workspace</p>
            <h1 className="font-display text-4xl leading-none text-paper sm:text-5xl">{milestone.title}</h1>
            <p className="max-w-3xl text-base leading-7 text-paper/72">{milestone.objective}</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-white/10 bg-white/6 p-5">
              <p className="editorial-kicker text-paper/55">Deliverable</p>
              <p className="mt-3 text-lg font-semibold text-paper">{milestone.deliverable}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 p-5">
              <p className="editorial-kicker text-paper/55">Time estimate</p>
              <p className="mt-3 text-lg font-semibold text-paper">{milestone.rough_time_estimate}</p>
            </div>
          </div>
        </div>
      </Card>

      <StepTimeline milestones={workspace.milestones} projectId={workspace.project.id} activeStepNumber={milestone.stepNumber} />

      {toggleError ? <Alert tone="danger">{toggleError}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-4">
          <p className="editorial-kicker">Step objective</p>
          <p className="text-sm leading-6 text-ink-soft">{milestone.objective}</p>
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

        <Card className="space-y-4">
          <p className="editorial-kicker">Why this step matters</p>
          <p className="text-sm leading-6 text-ink-soft">
            Each step is meant to produce one visible artifact. Keep the finishable version moving before you add polish.
          </p>
          <div className="text-sm leading-6 text-ink-soft">
            {workspace.nextMilestone?.id === milestone.id
              ? "This is the current focus step."
              : milestone.isFuture
                ? "This step stays visible early, but it should remain de-emphasized until earlier work is locked in."
                : "This step is already in motion or complete."}
          </div>
        </Card>
      </div>

      {!hasDetailAccess ? (
        <Card className="space-y-4">
          <p className="editorial-kicker">Premium step coaching</p>
          <h2 className="text-2xl font-semibold text-ink">Upgrade to unlock detailed step guidance and work evaluation.</h2>
          <p className="text-sm leading-6 text-ink-soft">
            Free keeps the roadmap, project pages, and each step objective visible so you can try one software project and one research project. Pro adds the full coaching experience for each step, including detailed guidance, done-when review, and AI evaluation of your work.
          </p>
          <div>
            <Button href="/billing" className="rounded-full px-6">
              Upgrade to Pro
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {!isGuidanceLocked && guidanceError ? <Alert tone="danger">{guidanceError}</Alert> : null}

          <Card className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="editorial-kicker">Step guidance</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">One context at a time.</h2>
              </div>
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
                <Card tone="subtle" padding="sm">
                  <p className="editorial-kicker">Coaching note</p>
                  <p className="mt-2 text-sm leading-6 text-ink-soft">{guidanceSlot.guidance.encouragement}</p>
                </Card>

                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "checklist", label: "Checklist / Do" },
                    { value: "pitfalls", label: "Watch Out / Pitfalls" },
                    { value: "tools", label: "Tools / Resources" },
                    { value: "done_when", label: "Done When" },
                  ].map((tab) => (
                    <button
                      key={tab.value}
                      type="button"
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium transition",
                        activeTab === tab.value ? "muted-toggle-surface-active" : "muted-toggle-surface",
                      )}
                      onClick={() => setActiveTab(tab.value as GuidanceTab)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeTab === "checklist" ? (
                  <Card tone="primary" className="space-y-4">
                    <p className="editorial-kicker">Checklist / Do</p>
                    <p className="text-sm leading-6 text-ink-soft">{guidanceSlot.guidance.what_to_do_now}</p>
                    <ol className="space-y-3">
                      {guidanceSlot.guidance.checklist.map((item, index) => (
                        <li key={`${item}-${index}`} className="rounded-2xl bg-paper/70 px-4 py-3">
                          <label className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 h-4 w-4 rounded border-line accent-primary"
                              checked={checkedItems[index] ?? false}
                              onChange={() =>
                                setCheckedItems((current) => ({
                                  ...current,
                                  [index]: !current[index],
                                }))
                              }
                            />
                            <span className="text-sm leading-6 text-ink-soft">{normalizeGuidanceItem(item, "ordered")}</span>
                          </label>
                        </li>
                      ))}
                    </ol>
                  </Card>
                ) : null}

                {activeTab === "pitfalls" ? (
                  <Card className="space-y-4">
                    <p className="editorial-kicker">Watch Out / Pitfalls</p>
                    <GuidanceList items={guidanceSlot.guidance.pitfalls} />
                  </Card>
                ) : null}

                {activeTab === "tools" ? (
                  <Card className="space-y-4">
                    <p className="editorial-kicker">Tools / Resources</p>
                    <GuidanceList items={guidanceSlot.guidance.tools_resources} />
                  </Card>
                ) : null}

                {activeTab === "done_when" ? (
                  <Card className="space-y-4">
                    <p className="editorial-kicker">Done When / Acceptance</p>
                    <GuidanceList items={guidanceSlot.guidance.done_when} />
                  </Card>
                ) : null}

                <GenerationFeedbackForm
                  variant="compact"
                  stage="step_guidance"
                  milestoneGuidanceId={guidanceSlot.guidanceId}
                  title="How is this coaching?"
                  description="Optional. Share what feels useful, too heavy, or missing."
                />
              </>
            ) : (
              <p className="text-sm leading-6 text-ink-soft">
                {isGuidancePending ? "Loading step guidance..." : "Open guidance to load the current coaching for this step."}
              </p>
            )}
          </Card>

          <div className="space-y-4" id="submission-area">
            {isGuidanceLocked ? (
              <Alert tone="warning" heading="Feedback stays focused, too">
                {submissionLockMessage}
              </Alert>
            ) : null}

            <SubmissionSummary
              slot={submissionSlot}
              evaluationError={evaluationError}
              isEvaluationPending={isEvaluationPending}
              actionsDisabled={isGuidanceLocked}
              onOpenComposer={() => {
                setIsComposerOpen(true);
                setIsResubmitMode(true);
              }}
            />

            {fallbackEvaluation ? (
              <EvaluationResult
                title="Last completed evaluation"
                note={
                  submissionSlot.status === "pending"
                    ? "Your newest submission is still pending, so Sevri is keeping the last completed evaluation visible."
                    : "Your newest submission failed to evaluate, so Sevri is keeping the last completed evaluation visible."
                }
                submission={fallbackEvaluation.submission}
                evaluationId={fallbackEvaluation.evaluation_id}
                evaluation={fallbackEvaluation.evaluation}
                actionsDisabled={isGuidanceLocked}
              />
            ) : null}
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
  actionsDisabled,
  onOpenComposer,
}: {
  slot: SubmissionSlot;
  evaluationError: string | null;
  isEvaluationPending: boolean;
  actionsDisabled: boolean;
  onOpenComposer: () => void;
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
        evaluationId={slot.evaluationId}
        evaluation={slot.evaluation}
        actionsDisabled={actionsDisabled}
        onResubmit={onOpenComposer}
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

          <MilestoneSubmissionForm onSubmit={onSubmit} disabled={isPending} />
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
    return {
      title: "Latest evaluation saved",
      description: slot.evaluation.ready_to_mark_complete
        ? "This step looks ready to mark complete."
        : "You have feedback ready for another revision.",
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
      </div>

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
  evaluationId,
  evaluation,
  onResubmit,
  actionsDisabled = false,
  title = "Latest evaluation",
  note,
}: {
  submission: StoredMilestoneSubmission;
  evaluationId?: string;
  evaluation: WorkEvaluation;
  onResubmit?: () => void;
  actionsDisabled?: boolean;
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResubmit}
            className="rounded-full"
            disabled={actionsDisabled}
          >
            Submit new version
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Criterion verdicts</p>
        <ul className="space-y-2">
          {evaluation.criterion_verdicts.map((verdict, index) => (
            <li key={`${verdict.criterion}-${index}`} className="flex items-start gap-2 text-sm">
              <Badge tone={VERDICT_TONE[verdict.verdict]} className="mt-0.5 shrink-0 text-[10px]">
                {VERDICT_LABEL[verdict.verdict]}
              </Badge>
              <div>
                <span className="font-medium text-ink">{verdict.criterion}</span>
                <span className="text-ink-soft"> - {verdict.note}</span>
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
        <p className="text-xs text-ink-muted">Address the gap above before you mark this step complete.</p>
      )}

      {evaluationId ? (
        <GenerationFeedbackForm
          variant="compact"
          stage="work_evaluation"
          submissionEvaluationId={evaluationId}
          title="How did this evaluation feel?"
          description="Optional. This does not change the verdict. It only sharpens future review quality."
        />
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
