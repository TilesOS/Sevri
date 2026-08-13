"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Crosshair,
  Lock,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { roadmapStatusClassName } from "@/components/project/project-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { GenerationFeedbackForm } from "@/components/shared/generation-feedback-form";
import { GithubStepCommits } from "@/components/project/github-step-commits";
import { useDockAutoCollapse, useDockClearance } from "@/components/project/submission-dock-chrome";
import { Disclosure } from "@/components/ui/disclosure";
import { Input } from "@/components/ui/input";
import { ReviewerFeedbackPanel } from "@/components/reviewer/reviewer-feedback-panel";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { isRateLimited, toUserFacingError } from "@/lib/errors/user-messages";
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
import { buildRebuttalSubmissionPayload } from "@/lib/projects/rebuttal";
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
  code?: "upgrade_required" | "previous_step_incomplete" | "rate_limited";
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

const ACCEPTED_FILE_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.pdf,.md,.txt,.json,.csv";
const MAX_SUBMISSION_CHARS = 20_000;
const MAX_REBUTTAL_CHARS = 500;
type EvidenceDraft = { upload_path?: string; external_url?: string; display_name: string; mime_type?: string; size_bytes?: number; caption?: string; alt_text?: string };

async function stripImageMetadata(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/u.test(file.type)) return file;
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not prepare image.")), file.type, 0.92));
  return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
};

type EvaluationHeadline = "Done" | "Drifted" | "Gap";

function getEvaluationHeadline(evaluation: WorkEvaluation): EvaluationHeadline {
  if (evaluation.scope_assessment?.drifted) {
    return "Drifted";
  }

  if (evaluation.ready_to_mark_complete) {
    return "Done";
  }

  return "Gap";
}

function getEvaluationFocus(evaluation: WorkEvaluation) {
  if (getEvaluationHeadline(evaluation) === "Drifted") {
    return evaluation.scope_assessment?.out_of_scope_note ?? evaluation.next_best_action;
  }

  return evaluation.next_best_action;
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
  if (filename) return `Evidence: ${filename}`;
  return "Evidence bundle";
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
  const [guidanceSlot, setGuidanceSlot] = useState<GuidanceSlot | null>(null);
  const [guidanceError, setGuidanceError] = useState<string | null>(null);
  /** Non-blocking note (e.g. a throttled refresh) shown above content that stays visible. */
  const [guidanceNotice, setGuidanceNotice] = useState<string | null>(null);
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
  const { dockRef, clearance: dockClearance } = useDockClearance<HTMLDivElement>();
  // Never gets out of the way mid-submission — the composer is the dock.
  const { isCollapsed: isDockCollapsed, expand: expandDock } = useDockAutoCollapse(isComposerOpen);
  const guidanceLockMessage = getGuidanceLockMessage(guidanceLock?.previousStepNumber ?? milestone.previousStepNumber);
  const submissionLockMessage = getSubmissionLockMessage(guidanceLock?.previousStepNumber ?? milestone.previousStepNumber);

  useEffect(() => {
    setGuidanceSlot(null);
    setGuidanceError(null);
    setGuidanceNotice(null);
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
      setToggleError(toUserFacingError(body?.error, "We couldn't save that change. Try again in a moment."));
      setIsCompletionPending(false);
      return;
    }

    setIsCompletionPending(false);
    window.dispatchEvent(
      new CustomEvent("sevri:project-sidebar-refresh", {
        detail: { projectId: workspace.project.id },
      }),
    );
    router.refresh();
  }

  async function fetchGuidance(refresh = false) {
    if (milestone.guidanceLocked) {
      setGuidanceLock({ previousStepNumber: milestone.previousStepNumber });
      return;
    }

    setIsGuidancePending(true);
    setGuidanceError(null);
    setGuidanceNotice(null);

    type GuidanceResponseBody = {
      guidance?: StepGuidance;
      milestone_guidance_id?: string;
      checklist_state?: Record<string, boolean>;
      rate_limited?: boolean;
      notice?: string;
    } & RouteErrorBody;

    let result: { response: Response; body: GuidanceResponseBody | null } | null = null;

    try {
      const response = await fetch(`/api/ai/milestones/${milestone.id}/guidance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      result = { response, body: await response.json().catch(() => null) };
    } catch {
      setGuidanceError("We couldn't reach Sevri. Check your connection and try again.");
      setIsGuidancePending(false);
      return;
    }

    const { response, body } = result;

    if (body?.code === "previous_step_incomplete") {
      setGuidanceSlot(null);
      setGuidanceLock({ previousStepNumber: body.previous_step_number ?? milestone.previousStepNumber });
      setGuidanceError(null);
      setIsGuidancePending(false);
      return;
    }

    if (!response.ok || !body?.guidance || !body.milestone_guidance_id) {
      setGuidanceLock(null);
      // A throttled request is not a failure — it is a "not right now". It never
      // replaces stored coaching that is already on screen.
      if (isRateLimited(response.status, body?.code)) {
        setGuidanceNotice(toUserFacingError(body?.error, "You're moving fast — try again in about a minute."));
      } else {
        setGuidanceError(toUserFacingError(body?.error, "We couldn't load the coaching for this step."));
      }
      setIsGuidancePending(false);
      return;
    }

    setGuidanceLock(null);
    setGuidanceSlot({
      guidance: body.guidance,
      guidanceId: body.milestone_guidance_id,
      checklistState: body.checklist_state ?? {},
    });
    // Stored coaching served in place of a throttled refresh: the content below
    // is real and stays visible; only the "this is not newly generated" note is new.
    setGuidanceNotice(body.rate_limited ? body.notice ?? null : null);
    setIsGuidancePending(false);
  }

  async function fetchSubmissionState() {
    const response = await fetch(`/api/ai/milestones/${milestone.id}/evaluate`);
    const body = (await response.json().catch(() => null)) as (MilestoneEvaluationResponse & RouteErrorBody) | null;

    if (!response.ok || !body) {
      throw new Error(toUserFacingError(body?.error, "We couldn't load your saved feedback."));
    }

    return body;
  }

  async function loadSubmission() {
    setSubmissionSlot({ status: "loading" });
    setEvaluationError(null);

    try {
      const body = await fetchSubmissionState();
      setSubmissionSlot(buildSubmissionSlot(body));
    } catch (loadError) {
      setSubmissionSlot({ status: "empty" });
      setEvaluationError(
        toUserFacingError(loadError, "We couldn't load your saved feedback. Your work is still saved."),
      );
    }
  }

  fetchGuidanceRef.current = fetchGuidance;
  loadSubmissionRef.current = loadSubmission;

  async function submitWork(
    text: string,
    artifacts: EvidenceDraft[],
    evidenceSubmissionId: string | null = null,
  ) {
    setIsEvaluationPending(true);
    setEvaluationError(null);

    try {
      const response = await fetch(`/api/ai/milestones/${milestone.id}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_text: text,
          artifacts,
          evidence_submission_id: evidenceSubmissionId,
        }),
      });

      const body = (await response.json().catch(() => null)) as (MilestoneEvaluationResponse & RouteErrorBody) | null;

      if (!response.ok || !body) {
        setEvaluationError(
          isRateLimited(response.status, body?.code)
            ? toUserFacingError(body?.error, "You're moving fast — try again in about a minute.")
            : toUserFacingError(body?.error, "We couldn't save your submission. Try again in a moment."),
        );
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
        setEvaluationError(
          "We couldn't reach Sevri. Your submission may already be saved — refresh the page to check.",
        );
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
    // pb-36 is the pre-measurement floor; once the dock reports its real height
    // the padding matches it exactly, so the bar can never sit over content at
    // any zoom level or viewport height.
    <div
      className="space-y-7 pb-36"
      style={dockClearance !== null ? { paddingBottom: dockClearance } : undefined}
    >
      {currentFocus ? (
        <div className="sticky top-[4.25rem] z-30 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3 shadow-soft backdrop-blur-xl">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">Current focus</p>
            <p className="mt-0.5 text-sm leading-6 text-ink">{currentFocus}</p>
          </div>
        </div>
      ) : null}

      <PageHeader
        eyebrow={`Step ${milestone.stepNumber}`}
        title={safeRenderText(milestone.title, STEP_TITLE_SPEC).text}
        metadata={
          <>
            <Badge tone="neutral">{workspace.projectKindLabel}</Badge>
            <Badge tone={milestone.completed ? "success" : milestone.status === "in_progress" ? "accent" : "neutral"}>
              {milestone.completed ? "Complete" : milestone.status === "in_progress" ? "In progress" : "Not started"}
            </Badge>
          </>
        }
        actions={
          <Button
            href={`/project/${workspace.project.id}/focus?milestone=${encodeURIComponent(milestone.id)}`}
            leadingIcon={<Crosshair className="h-4 w-4" />}
          >
            Start focus block
          </Button>
        }
      />

      <StepTimeline milestones={workspace.milestones} projectId={workspace.project.id} activeStepNumber={milestone.stepNumber} />

      {toggleError ? <Alert tone="danger">{toggleError}</Alert> : null}

      {workspace.githubLink?.status === "active" ? (
        <GithubStepCommits projectId={workspace.project.id} milestoneId={milestone.id} />
      ) : null}

      <Card tone="primary" padding="lg" elevation="soft" className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-paper/80 text-teal-deep shadow-[0_1px_2px_rgba(32,32,29,0.04)]">
          <Target className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <p className="editorial-kicker">Step objective</p>
          <p className="mt-2 max-w-3xl text-[15px] font-medium leading-7 text-ink">
            {safeRenderText(milestone.objective, STEP_OBJECTIVE_SPEC).text}
          </p>
        </div>
        <Button
          type="button"
          variant={milestone.completed ? "outline" : "primary"}
          leadingIcon={milestone.completed ? <CheckCircle2 className="h-4 w-4" /> : undefined}
          onClick={() => void toggleMilestone()}
          disabled={isCompletionPending}
        >
          {isCompletionPending
            ? "Saving..."
            : milestone.completed
              ? "Mark as not complete"
              : "Mark step complete"}
        </Button>
      </Card>

      {!hasDetailAccess ? (
        <Card tone="contrast" padding="lg" className="relative overflow-hidden">
          <div className="aurora-fallback pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative z-10 max-w-3xl">
            <div className="flex items-center gap-2 text-cream/65">
              <Lock className="h-4 w-4" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em]">Premium step coaching</p>
            </div>
            <h2 className="mt-4 font-display text-2xl leading-tight text-cream sm:text-3xl">
              Turn every roadmap step into a focused workbench.
            </h2>
            <p className="mt-3 text-sm leading-6 text-cream/70">
              Pro adds a tailored checklist, done-when criteria, and honest evaluation of the work you submit—right where you need the next move.
            </p>
            <div className="mt-6">
              <Button href="/settings/billing" variant="contrast">Unlock coaching with Pro</Button>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {!isGuidanceLocked && guidanceError ? <Alert tone="danger">{guidanceError}</Alert> : null}
          {!isGuidanceLocked && guidanceNotice ? <Alert tone="warning">{guidanceNotice}</Alert> : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start">
          <Card padding="lg" elevation="soft" className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary-hover">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="editorial-kicker">Workbench</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight text-ink">Your next concrete moves</h2>
                </div>
              </div>
              {isGuidanceLocked ? (
                <Badge tone="warning">Locked</Badge>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
                  onClick={() => void fetchGuidance(true)}
                  disabled={isGuidancePending}
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
                <div className="space-y-5 rounded-2xl bg-surface/70 p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">Checklist</p>
                    <span className="text-xs tabular-nums text-ink-muted">
                      {Object.values(checkedItems).filter(Boolean).length} of {guidanceSlot.guidance.checklist.length} done
                    </span>
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
                            "rounded-xl border px-4 py-3.5 transition-colors",
                            isCurrentTask
                              ? "border-primary/25 bg-primary-soft shadow-[0_1px_2px_rgba(32,32,29,0.04)]"
                              : checkedItems[index]
                                ? "border-transparent bg-paper/55"
                                : "border-line/80 bg-paper",
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
                              className="mt-1 h-4 w-4 rounded border-line accent-primary"
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
                </div>

                {/* Shared Disclosure: it owns the Show/Hide label swap and the
                    aria-controls wiring, so this page cannot drift from the rest. */}
                <Disclosure title="Show step detail">
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-medium text-ink-muted">Coaching note</p>
                      <p className="mt-2 text-sm leading-6 text-ink-soft">
                        {safeRenderText(guidanceSlot.guidance.encouragement, GUIDANCE_ENCOURAGEMENT_SPEC).text}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-ink-muted">Watch out</p>
                      <GuidanceList items={guidanceSlot.guidance.pitfalls} />
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-ink-muted">Tools / resources</p>
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
                </Disclosure>
              </>
            ) : (
              isGuidancePending ? (
                <div className="space-y-3" role="status" aria-live="polite">
                  <span className="sr-only">Loading step guidance</span>
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface-strong motion-reduce:animate-none" />
                  <div className="h-20 animate-pulse rounded-2xl bg-surface motion-reduce:animate-none" />
                  <div className="h-20 animate-pulse rounded-2xl bg-surface motion-reduce:animate-none" />
                  <div className="h-20 animate-pulse rounded-2xl bg-surface motion-reduce:animate-none" />
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-ink-soft">
                    {guidanceError || guidanceNotice
                      ? "The coaching for this step isn't on screen yet. Nothing you've saved is affected."
                      : "This step doesn't have coaching yet. Load it to get a checklist and done-when criteria."}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
                    onClick={() => void fetchGuidance()}
                    disabled={isGuidancePending}
                  >
                    {guidanceError || guidanceNotice ? "Try again" : "Load coaching"}
                  </Button>
                </div>
              )
            )}
          </Card>

          <aside className="space-y-4 xl:sticky xl:top-20" id="submission-area" aria-label="Step details and submission">
            {guidanceSlot ? (
              <Card tone="butter" padding="md" className="space-y-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-teal-deep" aria-hidden="true" />
                  <p className="text-sm font-semibold text-ink">Done when</p>
                </div>
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
              onRebuttal={(submission, rebuttal) => {
                const payload = buildRebuttalSubmissionPayload(submission, rebuttal);
                void submitWork(payload.submissionText, [], payload.evidenceSubmissionId);
              }}
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
                onRebuttal={(submission, rebuttal) => {
                  const payload = buildRebuttalSubmissionPayload(submission, rebuttal);
                  void submitWork(payload.submissionText, [], payload.evidenceSubmissionId);
                }}
              />
            ) : null}

            <ReviewerFeedbackPanel reviews={reviews} />
          </aside>
          </div>

          <SubmissionDock
            dockRef={dockRef}
            isCollapsed={isDockCollapsed}
            onRequestExpand={expandDock}
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
            onSubmit={(text, artifacts) => void submitWork(text, artifacts)}
            evaluationError={evaluationError}
            actionsDisabled={isGuidanceLocked}
            lockedMessage={submissionLockMessage}
            projectId={workspace.project.id}
            milestoneId={milestone.id}
            githubImportEnabled={
              workspace.githubLink?.status === "active"
            }
            autoImportFromGithub={
              returningFromFocus &&
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
    <div className="overflow-x-auto pb-1 lg:hidden" aria-label="Project steps">
      <div className="flex min-w-max gap-2 rounded-2xl border border-line bg-paper p-2">
        {milestones.map((item) => {
          const isActive = item.stepNumber === activeStepNumber;

          return (
            <Link
              key={item.id}
              href={`/project/${projectId}/steps/${item.stepNumber}`}
              className={cn(
                "min-w-[9.5rem] rounded-xl border px-3 py-2.5 transition-colors",
                isActive
                  ? "border-primary/20 bg-primary-soft text-ink"
                  : "border-transparent bg-transparent text-ink-soft hover:bg-surface",
                item.isFuture && !isActive && "opacity-70",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">Step {item.stepNumber}</p>
                  <p className="mt-1.5 line-clamp-1 text-sm font-semibold text-current">{item.title}</p>
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
        <p className="text-sm font-medium text-ink">Submission</p>
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
  dockRef,
  isCollapsed,
  onRequestExpand,
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
  dockRef: (node: HTMLDivElement | null) => void;
  isCollapsed: boolean;
  onRequestExpand: () => void;
  slot: SubmissionSlot;
  isOpen: boolean;
  isPending: boolean;
  isResubmitMode: boolean;
  onToggle: () => void;
  onResubmit: () => void;
  onCancel: () => void;
  onSubmit: (text: string, artifacts: EvidenceDraft[]) => void;
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
    <div
      ref={dockRef}
      onFocusCapture={isCollapsed ? onRequestExpand : undefined}
      className={cn(
        "fixed bottom-4 left-4 right-4 z-40 lg:left-auto lg:w-[min(44rem,calc(100vw-18rem))] lg:right-8",
        // Narrow screens only: the dock steps aside while you read downward and
        // comes back the moment you scroll up. Desktop has room and keeps it put.
        "motion-safe:transition-transform motion-safe:duration-200 lg:translate-y-0",
        isCollapsed && "translate-y-[calc(100%+1rem)] lg:translate-y-0",
      )}
    >
      {isOpen && !actionsDisabled ? (
        <Card padding="lg" elevation="lifted" className="mb-3 space-y-4 border-line bg-paper/95 backdrop-blur-xl">
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

      <Card className="border-line bg-paper/95 px-4 py-3 shadow-lifted backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                actionsDisabled
                  ? "bg-ink-muted"
                  : slot.status === "completed"
                    ? "bg-teal-deep"
                    : slot.status === "failed"
                      ? "bg-red-500"
                      : "bg-primary",
              )}
              aria-hidden="true"
            />
            <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{summary.title}</p>
            <p className="truncate text-xs text-ink-muted">{summary.description}</p>
            </div>
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
            <Button type="button" size="sm" onClick={onToggle} disabled={actionsDisabled}>
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
  onSubmit: (text: string, artifacts: EvidenceDraft[]) => void;
  disabled: boolean;
  projectId: string;
  milestoneId: string;
  githubImportEnabled: boolean;
  autoImportFromGithub: boolean;
}) {
  const [pastedText, setPastedText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [externalUrl, setExternalUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

  const combinedLength = pastedText.length;
  const hasContent = pastedText.trim().length > 0 || files.length > 0 || externalUrl.trim().length > 0;
  const isOverLimit = combinedLength > MAX_SUBMISSION_CHARS;
  const totalBytes = files.reduce((sum, item) => sum + item.size, 0);
  const hasInvalidBundle = files.length + (externalUrl.trim() ? 1 : 0) > 5 || totalBytes > 25 * 1024 * 1024;
  const hasMissingCaptions = files.some(
    (file) => !file.type.startsWith("text/") && !captions[file.name]?.trim(),
  );

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.length) {
      setFiles([]);
      return;
    }
    const selectedFiles = Array.from(event.target.files ?? []);
    setFiles(selectedFiles.slice(0, 5));
  }

  function clearFiles() {
    setFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit() {
    if (!hasContent || isOverLimit || hasInvalidBundle || hasMissingCaptions || disabled || isUploading) {
      return;
    }
    setIsUploading(true);
    setImportError(null);
    try {
      const artifacts: EvidenceDraft[] = [];
      for (const originalFile of files) {
        const file = await stripImageMetadata(originalFile);
        const ticketResponse = await fetch(`/api/milestones/${milestoneId}/artifacts/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, mime_type: file.type, size_bytes: file.size }) });
        const ticket = await ticketResponse.json() as { path?: string; token?: string; error?: string };
        if (!ticketResponse.ok || !ticket.path || !ticket.token) throw new Error(ticket.error ?? `Could not upload ${file.name}.`);
        const { error } = await createClient().storage.from("project-evidence").uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });
        if (error) throw error;
        const caption = captions[originalFile.name]?.trim();
        artifacts.push({ upload_path: ticket.path, display_name: file.name, mime_type: file.type, size_bytes: file.size, caption, alt_text: file.type.startsWith("image/") ? caption : undefined });
      }
      if (externalUrl.trim()) {
        const hostname = new URL(externalUrl.trim()).hostname;
        artifacts.push({ external_url: externalUrl.trim(), display_name: hostname, caption: `Evidence link from ${hostname}`, alt_text: `External evidence hosted on ${hostname}` });
      }
      onSubmit(pastedText, artifacts);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Could not upload the evidence bundle.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Textarea
        placeholder="Describe what you made, what changed, and what this evidence shows…"
        value={pastedText}
        onChange={(event) => setPastedText(event.target.value)}
        disabled={disabled}
        rows={6}
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
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
          {files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Attach evidence"}
        </Button>
        {files.length ? (
          <button type="button" className="text-xs text-ink-muted hover:text-ink" onClick={clearFiles} disabled={disabled}>
            Remove files
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

      {files.length ? <div className="space-y-2">{files.map((file) => <label key={`${file.name}-${file.size}`} className="block rounded-xl bg-surface p-3 text-xs text-ink-soft"><span className="font-medium text-ink">{file.name}</span><span className="ml-2 text-ink-muted">{Math.ceil(file.size / 1024).toLocaleString()} KB</span><Input className="mt-2" value={captions[file.name] ?? ""} onChange={(event) => setCaptions((current) => ({ ...current, [file.name]: event.target.value }))} placeholder={file.type.startsWith("image/") ? "Required caption and accessible description" : "What does this evidence show?"} /></label>)}</div> : null}

      <Input type="url" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="Or add one HTTPS evidence link (Sevri will not fetch it)" disabled={disabled} />

      {importError ? <p className="text-xs text-red-600">{importError}</p> : null}
      {importInfo ? <p className="text-xs text-ink-muted">{importInfo}</p> : null}
      {hasMissingCaptions ? <p className="text-xs text-red-600">Add a caption for each image or document before submitting.</p> : null}

      <p className="text-xs text-ink-muted">Up to 5 items, 10 MB each, 25 MB total. Images are re-encoded before upload to remove embedded metadata.</p>

      <div className="flex items-center justify-between gap-4">
        <span className={cn("text-xs", isOverLimit || hasInvalidBundle ? "font-medium text-red-600" : "text-ink-muted")}>
          {combinedLength.toLocaleString()} / {MAX_SUBMISSION_CHARS.toLocaleString()} characters · {Math.ceil(totalBytes / 1024).toLocaleString()} KB
        </span>
        <Button type="button" size="sm" onClick={() => void handleSubmit()} disabled={!hasContent || isOverLimit || hasInvalidBundle || hasMissingCaptions || disabled || isUploading}>
          {isUploading ? "Uploading…" : disabled ? "Evaluating..." : "Get evaluation"}
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

      <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Evidence reviewed</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-ink-soft">
            {evaluation.evidence_reviewed.map((item) => <li key={item}>• {item}</li>)}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Evidence limitations</p>
          {evaluation.evidence_limitations.length ? (
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-ink-soft">
              {evaluation.evidence_limitations.map((item) => <li key={item}>• {item}</li>)}
            </ul>
          ) : <p className="mt-2 text-sm leading-6 text-ink-muted">No material limitations were identified.</p>}
        </div>
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
    <ul className="space-y-2.5 text-sm leading-6 text-ink-soft">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-3">
          <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
          <span>{normalizeGuidanceItem(item, "bullet")}</span>
        </li>
      ))}
    </ul>
  );
}
