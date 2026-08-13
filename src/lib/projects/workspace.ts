import { cache } from "react";
import { getTodayDateString } from "@/lib/calendar/date-utils";
import { deriveUrgencyState } from "@/lib/calendar/urgency";
import type { CalendarUrgency } from "@/lib/calendar/types";
import { getProjectWorkspace } from "@/lib/db/queries/projects";
import { getProjectGithubLink, type ProjectGithubLinkRow } from "@/lib/db/queries/github";
import { getMilestoneGuidance } from "@/lib/db/queries/milestone-guidance";
import { deriveMilestoneProgressMeta } from "@/lib/projects/milestone-status";
import { getProjectProgressSummary, type ProjectProgressSummary } from "@/lib/projects/progress";
import {
  composePitchKitDraft,
  composeScopeStatement,
  formatTalkingPoint,
  isUsableStoredCopy,
  isUsableStoredCopyList,
  parseTalkingPoint,
  toDeferralList,
} from "@/lib/projects/pitch-kit";
import { getStepGuidanceGate } from "@/lib/projects/step-guidance-lock";
import { LearningResourceSchema, type LearningResource } from "@/lib/ai/schemas";
import { asSentence } from "@/lib/text/prose";
import { toStudentVoice } from "@/lib/text/student-voice";

export interface ProjectGithubLinkView {
  id: string;
  repo_full_name: string;
  default_branch: string;
  status: "active" | "broken";
  last_synced_at: string | null;
  cached_readme: string | null;
}

type RawProjectWorkspace = Awaited<ReturnType<typeof getProjectWorkspace>>;

export type ProjectStepStatus = "complete" | "in_progress" | "not_started";

export interface ProjectMilestoneView {
  id: string;
  order_index: number;
  stepNumber: number;
  title: string;
  description: string;
  objective: string;
  deliverable: string;
  rough_time_estimate: string;
  dueDate: string | null;
  scheduleDurationDays: number | null;
  isUserScheduledOverride: boolean;
  urgency: CalendarUrgency | null;
  completed: boolean;
  status: ProjectStepStatus;
  isFuture: boolean;
  guidanceLocked: boolean;
  previousStepNumber: number | null;
  scopeGuardrail: string;
}

export interface ProjectLensItem {
  label: string;
  value: string;
}

export interface ParsedTalkingPoint {
  raw: string;
  label: string;
  body: string;
}

/**
 * The written surfaces of the workspace, resolved from storage.
 *
 * Stored copy is used when it passes the content lint. Roadmaps written before
 * the pitch kit was model-generated carry template-stitched prose (". and",
 * "? with", third-person voice); rather than migrate that text, it is recomposed
 * from the structured fields that are also stored and marked as a draft.
 */
export interface ProjectPitchKitView {
  elevatorPitch: string;
  resumeBullets: string[];
  talkingPoints: string[];
  parsedTalkingPoints: ParsedTalkingPoint[];
  isDraft: boolean;
}

/**
 * Adaptive "what to do next" preview rendered on the project overview.
 * Pulls from the current step's stored guidance + saved checklist state.
 */
export interface NextStepActionPreview {
  stepNumber: number;
  stepTitle: string;
  stepObjective: string;
  /** The first unchecked checklist item, or null if all are checked / no checklist saved yet. */
  nextChecklistItem: string | null;
  /** Total checklist items in the current guidance (0 if guidance not yet generated). */
  totalChecklistItems: number;
  /** How many items the user has checked off. */
  checkedCount: number;
  /** True when guidance exists and every checklist item is checked. */
  allChecked: boolean;
  /** True when no guidance row has been generated yet for this step. */
  guidanceMissing: boolean;
}

export interface ProjectWorkspaceView {
  project: RawProjectWorkspace["project"];
  roadmap: RawProjectWorkspace["roadmap"];
  projectKindLabel: string;
  hasRoadmap: boolean;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  scheduleTimezone: string;
  scheduleReady: boolean;
  milestones: ProjectMilestoneView[];
  completedCount: number;
  completionPercent: number;
  progress: ProjectProgressSummary;
  /** "Cut if behind" items, phrased as deferrals rather than as delete-now instructions. */
  stretchGoals: string[];
  projectBrief: string;
  projectLens: ProjectLensItem[];
  keyDeliverables: string[];
  /** The Scope & Guardrails statement, recomposed when the stored one is stitched. */
  coreScope: string;
  pitchKit: ProjectPitchKitView;
  learningResources: LearningResource[];
  elevatorPitch: string;
  resumeBullets: string[];
  talkingPoints: string[];
  parsedTalkingPoints: ParsedTalkingPoint[];
  firstIncompleteStepNumber: number | null;
  nextMilestone: ProjectMilestoneView | null;
  nextStepAction: NextStepActionPreview | null;
  githubLink: ProjectGithubLinkView | null;
}

function getPayloadString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function getPayloadStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

const EMPTY_PITCH_KIT: ProjectPitchKitView = {
  elevatorPitch: "",
  resumeBullets: [],
  talkingPoints: [],
  parsedTalkingPoints: [],
  isDraft: false,
};

/**
 * Resolves the pitch kit for display. Model-written copy is shown as written;
 * anything else is re-derived from the stored option seed so older projects get
 * readable prose without a data migration, and is labeled as a draft.
 */
function resolvePitchKitView(input: {
  explanationGuide: Record<string, unknown>;
  projectTitle: string;
  optionSeed: Record<string, unknown>;
  firstDeliverable: string | null;
  stepCount: number;
}): ProjectPitchKitView {
  const storedPitch = getPayloadString(input.explanationGuide.elevator_pitch);
  const storedBullets = getPayloadStringList(input.explanationGuide.resume_bullets);
  const storedPoints = getPayloadStringList(input.explanationGuide.interview_talking_points);

  const storedIsUsable =
    isUsableStoredCopy(storedPitch) &&
    isUsableStoredCopyList(storedBullets) &&
    isUsableStoredCopyList(storedPoints);

  if (storedIsUsable) {
    return {
      elevatorPitch: storedPitch,
      resumeBullets: storedBullets,
      talkingPoints: storedPoints,
      parsedTalkingPoints: toParsedTalkingPoints(storedPoints),
      isDraft: input.explanationGuide.source === "draft",
    };
  }

  // Without a stored option seed there is nothing true to say about the project,
  // so the page keeps its empty state rather than showing invented copy.
  const hasSeed = Object.values(input.optionSeed).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (!hasSeed) {
    return EMPTY_PITCH_KIT;
  }

  const draft = composePitchKitDraft({
    projectTitle: input.projectTitle,
    seed: input.optionSeed,
    firstDeliverable: input.firstDeliverable,
    stepCount: input.stepCount,
  });
  const talkingPoints = draft.talkingPoints.map((point) => formatTalkingPoint(point));

  return {
    elevatorPitch: draft.elevatorPitch,
    resumeBullets: draft.resumeBullets,
    talkingPoints,
    parsedTalkingPoints: toParsedTalkingPoints(talkingPoints),
    isDraft: true,
  };
}

function toParsedTalkingPoints(points: string[]): ParsedTalkingPoint[] {
  return points
    .map((raw) => ({ raw, parsed: parseTalkingPoint(raw) }))
    .filter((item): item is { raw: string; parsed: { label: string; body: string } } => item.parsed !== null)
    .map((item) => ({ raw: item.raw, label: item.parsed.label, body: item.parsed.body }));
}

function normalizeMilestones(
  milestones: RawProjectWorkspace["milestones"],
  scheduleTimezone: string,
  roadmapPayload: Record<string, unknown>,
): ProjectMilestoneView[] {
  const today = getTodayDateString(scheduleTimezone);
  const roadmapSteps = Array.isArray(roadmapPayload.steps)
    ? (roadmapPayload.steps as Array<Record<string, unknown>>)
    : [];

  return milestones.map((milestone) => {
    const stepNumber = milestone.order_index + 1;
    const guidanceGate = getStepGuidanceGate(milestones, milestone.order_index);
    const progress = deriveMilestoneProgressMeta(milestones, milestone.order_index);
    const status: ProjectStepStatus = progress.status;
    const roadmapStep = roadmapSteps.find((step) => step.order_index === milestone.order_index);

    return {
      ...milestone,
      stepNumber,
      objective:
        typeof milestone.objective === "string" && milestone.objective.trim().length > 0
          ? milestone.objective
          : milestone.description,
      deliverable:
        typeof milestone.deliverable === "string" && milestone.deliverable.trim().length > 0
          ? milestone.deliverable
          : "Concrete step output",
      rough_time_estimate:
        typeof milestone.rough_time_estimate === "string" && milestone.rough_time_estimate.trim().length > 0
          ? milestone.rough_time_estimate
          : "About 1 week",
      dueDate: milestone.due_date ?? null,
      scheduleDurationDays: milestone.schedule_duration_days ?? null,
      isUserScheduledOverride: milestone.is_user_scheduled_override,
      urgency: milestone.due_date
        ? deriveUrgencyState({
            completed: milestone.completed,
            date: milestone.due_date,
            today,
          })
        : null,
      status,
      isFuture: progress.isFuture,
      guidanceLocked: guidanceGate.guidanceLocked,
      previousStepNumber: guidanceGate.previousStepNumber,
      scopeGuardrail: getPayloadString(
        roadmapStep?.scope_guardrail,
        "Stay focused on this step's deliverable — do not expand scope.",
      ),
    };
  });
}

function summarizeGithubLink(row: ProjectGithubLinkRow | null): ProjectGithubLinkView | null {
  if (!row) return null;
  return {
    id: row.id,
    repo_full_name: row.repo_full_name,
    default_branch: row.default_branch,
    status: row.status,
    last_synced_at: row.last_synced_at,
    cached_readme: row.cached_readme,
  };
}

export const getProjectWorkspaceView = cache(async (projectId: string, userId: string): Promise<ProjectWorkspaceView> => {
  const workspace = await getProjectWorkspace(projectId, userId);
  const githubLinkRow = await getProjectGithubLink(projectId).catch(() => null);
  const projectKindLabel = workspace.project.project_kind_label || "Project";
  const scheduleTimezone =
    typeof workspace.roadmap?.schedule_timezone === "string" && workspace.roadmap.schedule_timezone.trim().length > 0
      ? workspace.roadmap.schedule_timezone
      : "UTC";
  const roadmapPayload =
    workspace.roadmap?.roadmap_context_json && typeof workspace.roadmap.roadmap_context_json === "object"
      ? (workspace.roadmap.roadmap_context_json as Record<string, unknown>)
      : {};
  const milestones = normalizeMilestones(workspace.milestones ?? [], scheduleTimezone, roadmapPayload);
  const completedCount = milestones.filter((milestone) => milestone.completed).length;
  const progress = getProjectProgressSummary({
    hasRoadmap: Boolean(workspace.roadmap),
    completedCount,
    totalMilestones: milestones.length,
    projectStatus: workspace.project.status,
  });
  const completionPercent = progress.percent;
  const scheduledStartDate = workspace.roadmap?.scheduled_start_date ?? null;
  const scheduledEndDate = workspace.roadmap?.scheduled_end_date ?? null;
  const scheduleReady =
    Boolean(scheduledStartDate) &&
    Boolean(scheduledEndDate) &&
    milestones.length > 0 &&
    milestones.every((milestone) => milestone.dueDate && milestone.scheduleDurationDays);
  // Older rows stored these as "Stretch later: ..." or as "Drop ..." imperatives,
  // which read as an instruction to cut the item now rather than to revisit it.
  const stretchGoals = toDeferralList(
    getPayloadStringList(workspace.roadmap?.stretch_goals),
  );
  const optionSeed =
    roadmapPayload.selected_project_blueprint && typeof roadmapPayload.selected_project_blueprint === "object"
      ? (roadmapPayload.selected_project_blueprint as Record<string, unknown>)
      : {};
  const projectBrief = toStudentVoice(getPayloadString(roadmapPayload.project_brief));
  const learningResources = Array.isArray(roadmapPayload.learning_resources)
    ? roadmapPayload.learning_resources.flatMap((resource) => {
        const parsed = LearningResourceSchema.safeParse(resource);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const projectLens = [
    { label: "Purpose", value: getPayloadString(optionSeed.central_challenge, "Keep the central challenge concrete and meaningful.") },
    { label: "Approach", value: getPayloadString(optionSeed.approach, "Use the simplest credible approach that fits your resources.") },
    { label: "Evidence", value: getPayloadString(getPayloadStringList(optionSeed.proof_of_success)[0], "Choose observable proof that the project worked.") },
    { label: "Core scope", value: getPayloadString(optionSeed.scope_boundary, "Protect the smallest complete version of the project.") },
  ].map((item) => ({ label: item.label, value: asSentence(toStudentVoice(item.value)) }));
  const explanationGuide =
    workspace.roadmap?.explanation_guide && typeof workspace.roadmap.explanation_guide === "object"
      ? (workspace.roadmap.explanation_guide as Record<string, unknown>)
      : {};
  const pitchKit = resolvePitchKitView({
    explanationGuide,
    projectTitle: workspace.project.title ?? "",
    optionSeed,
    firstDeliverable: milestones[0]?.deliverable ?? null,
    stepCount: milestones.length,
  });
  const storedCoreScope = getPayloadString(workspace.roadmap?.core_scope);
  const coreScope = isUsableStoredCopy(storedCoreScope)
    ? storedCoreScope
    : composeScopeStatement({ seed: optionSeed });
  const firstIncompleteStepNumber = milestones.find((milestone) => !milestone.completed)?.stepNumber ?? null;
  const nextMilestone = milestones.find((milestone) => !milestone.completed) ?? milestones[milestones.length - 1] ?? null;

  let nextStepAction: NextStepActionPreview | null = null;
  if (nextMilestone) {
    const guidance = await getMilestoneGuidance(nextMilestone.id).catch(() => null);

    if (guidance) {
      const checklist = guidance.guidance.checklist;
      const totalChecklistItems = checklist.length;
      const checkedCount = checklist.reduce(
        (count, _item, index) => (guidance.checklistState[String(index)] ? count + 1 : count),
        0,
      );
      const nextIndex = checklist.findIndex((_item, index) => !guidance.checklistState[String(index)]);
      const nextChecklistItem = nextIndex >= 0 ? checklist[nextIndex] : null;

      nextStepAction = {
        stepNumber: nextMilestone.stepNumber,
        stepTitle: nextMilestone.title,
        stepObjective: nextMilestone.objective,
        nextChecklistItem,
        totalChecklistItems,
        checkedCount,
        allChecked: totalChecklistItems > 0 && nextIndex === -1,
        guidanceMissing: false,
      };
    } else {
      nextStepAction = {
        stepNumber: nextMilestone.stepNumber,
        stepTitle: nextMilestone.title,
        stepObjective: nextMilestone.objective,
        nextChecklistItem: null,
        totalChecklistItems: 0,
        checkedCount: 0,
        allChecked: false,
        guidanceMissing: true,
      };
    }
  }

  return {
    project: workspace.project,
    roadmap: workspace.roadmap,
    projectKindLabel,
    hasRoadmap: Boolean(workspace.roadmap),
    scheduledStartDate,
    scheduledEndDate,
    scheduleTimezone,
    scheduleReady,
    milestones,
    completedCount,
    completionPercent,
    progress,
    stretchGoals,
    projectBrief,
    projectLens,
    keyDeliverables: milestones.slice(0, 3).map((milestone) => milestone.deliverable),
    coreScope,
    pitchKit,
    learningResources,
    elevatorPitch: pitchKit.elevatorPitch,
    resumeBullets: pitchKit.resumeBullets,
    talkingPoints: pitchKit.talkingPoints,
    parsedTalkingPoints: pitchKit.parsedTalkingPoints,
    firstIncompleteStepNumber,
    nextMilestone,
    nextStepAction,
    githubLink: summarizeGithubLink(githubLinkRow),
  };
});
