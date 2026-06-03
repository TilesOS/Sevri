import { cache } from "react";
import { getTodayDateString } from "@/lib/calendar/date-utils";
import { deriveUrgencyState } from "@/lib/calendar/urgency";
import type { CalendarUrgency } from "@/lib/calendar/types";
import { getProjectWorkspace } from "@/lib/db/queries/projects";
import { getProjectGithubLink, type ProjectGithubLinkRow } from "@/lib/db/queries/github";
import { getMilestoneGuidance } from "@/lib/db/queries/milestone-guidance";
import { deriveMilestoneProgressMeta } from "@/lib/projects/milestone-status";
import { getProjectProgressSummary, type ProjectProgressSummary } from "@/lib/projects/progress";
import { getStepGuidanceGate } from "@/lib/projects/step-guidance-lock";
import type { ProjectTrack } from "@/types/domain";

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
  projectTrack: ProjectTrack;
  hasRoadmap: boolean;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  scheduleTimezone: string;
  scheduleReady: boolean;
  milestones: ProjectMilestoneView[];
  completedCount: number;
  completionPercent: number;
  progress: ProjectProgressSummary;
  stretchGoals: string[];
  projectBrief: string;
  projectLens: ProjectLensItem[];
  keyDeliverables: string[];
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

function parseTalkingPoint(point: string) {
  const match = point.match(/^([^:]{3,40}):\s*(.+)$/);
  if (!match) {
    return null;
  }

  return {
    label: match[1].trim(),
    body: match[2].trim(),
  };
}

function normalizeMilestones(
  milestones: RawProjectWorkspace["milestones"],
  scheduleTimezone: string,
): ProjectMilestoneView[] {
  const today = getTodayDateString(scheduleTimezone);

  return milestones.map((milestone) => {
    const stepNumber = milestone.order_index + 1;
    const guidanceGate = getStepGuidanceGate(milestones, milestone.order_index);
    const progress = deriveMilestoneProgressMeta(milestones, milestone.order_index);
    const status: ProjectStepStatus = progress.status;

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
  const projectTrack = workspace.project.project_track === "research" ? "research" : "software";
  const scheduleTimezone =
    typeof workspace.roadmap?.schedule_timezone === "string" && workspace.roadmap.schedule_timezone.trim().length > 0
      ? workspace.roadmap.schedule_timezone
      : "UTC";
  const milestones = normalizeMilestones(workspace.milestones ?? [], scheduleTimezone);
  const completedCount = milestones.filter((milestone) => milestone.completed).length;
  const completionPercent = milestones.length === 0 ? 0 : Math.round((completedCount / milestones.length) * 100);
  const progress = getProjectProgressSummary({
    hasRoadmap: Boolean(workspace.roadmap),
    completedCount,
    totalMilestones: milestones.length,
    projectStatus: workspace.project.status,
  });
  const scheduledStartDate = workspace.roadmap?.scheduled_start_date ?? null;
  const scheduledEndDate = workspace.roadmap?.scheduled_end_date ?? null;
  const scheduleReady =
    Boolean(scheduledStartDate) &&
    Boolean(scheduledEndDate) &&
    milestones.length > 0 &&
    milestones.every((milestone) => milestone.dueDate && milestone.scheduleDurationDays);
  const stretchGoals = (Array.isArray(workspace.roadmap?.stretch_goals) ? workspace.roadmap?.stretch_goals : []).filter(
    (goal: unknown): goal is string => typeof goal === "string" && goal.trim().length > 0,
  );
  const roadmapPayload =
    workspace.roadmap?.track_payload_json && typeof workspace.roadmap.track_payload_json === "object"
      ? (workspace.roadmap.track_payload_json as Record<string, unknown>)
      : {};
  const optionSeed =
    roadmapPayload.selected_option_seed && typeof roadmapPayload.selected_option_seed === "object"
      ? (roadmapPayload.selected_option_seed as Record<string, unknown>)
      : {};
  const projectBrief = getPayloadString(roadmapPayload.project_brief);
  const projectLens =
    projectTrack === "research"
      ? [
          {
            label: "Research question",
            value: getPayloadString(optionSeed.research_question, "Clarify the final question once the roadmap begins."),
          },
          {
            label: "Methodology",
            value: getPayloadString(optionSeed.methodology, "Choose the cleanest method that matches your access."),
          },
          {
            label: "Evidence plan",
            value: getPayloadString(optionSeed.evidence_plan, "Protect the evidence you can realistically gather."),
          },
        ]
      : [
          {
            label: "Target user",
            value: getPayloadString(optionSeed.target_user, "Clarify who this project is genuinely for."),
          },
          {
            label: "Problem statement",
            value: getPayloadString(optionSeed.problem_statement, "Keep the core problem concrete and narrow."),
          },
          {
            label: "Core workflow",
            value: getPayloadString(optionSeed.core_workflow, "Protect the first workflow that makes the project feel real."),
          },
        ];
  const explanationGuide =
    workspace.roadmap?.explanation_guide && typeof workspace.roadmap.explanation_guide === "object"
      ? (workspace.roadmap.explanation_guide as Record<string, unknown>)
      : {};
  const resumeBullets = Array.isArray(explanationGuide.resume_bullets)
    ? explanationGuide.resume_bullets.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const talkingPoints = Array.isArray(explanationGuide.interview_talking_points)
    ? explanationGuide.interview_talking_points.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const parsedTalkingPoints = talkingPoints
    .map((point) => ({ raw: point, parsed: parseTalkingPoint(point) }))
    .filter((item): item is { raw: string; parsed: { label: string; body: string } } => item.parsed !== null)
    .map((item) => ({ raw: item.raw, label: item.parsed.label, body: item.parsed.body }));
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
    projectTrack,
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
    elevatorPitch: getPayloadString(explanationGuide.elevator_pitch),
    resumeBullets,
    talkingPoints,
    parsedTalkingPoints,
    firstIncompleteStepNumber,
    nextMilestone,
    nextStepAction,
    githubLink: summarizeGithubLink(githubLinkRow),
  };
});
