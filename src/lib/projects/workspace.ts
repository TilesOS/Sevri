import { cache } from "react";
import { getProjectWorkspace } from "@/lib/db/queries/projects";
import type { ProjectTrack } from "@/types/domain";

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
  completed: boolean;
  status: ProjectStepStatus;
  isFuture: boolean;
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

export interface ProjectWorkspaceView {
  project: RawProjectWorkspace["project"];
  roadmap: RawProjectWorkspace["roadmap"];
  projectTrack: ProjectTrack;
  hasRoadmap: boolean;
  milestones: ProjectMilestoneView[];
  completedCount: number;
  completionPercent: number;
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
): ProjectMilestoneView[] {
  const firstIncompleteIndex = milestones.findIndex((milestone) => !milestone.completed);

  return milestones.map((milestone) => {
    const stepNumber = milestone.order_index + 1;
    const status: ProjectStepStatus = milestone.completed
      ? "complete"
      : firstIncompleteIndex === -1 || milestone.order_index === firstIncompleteIndex
        ? "in_progress"
        : "not_started";

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
      status,
      isFuture: !milestone.completed && firstIncompleteIndex !== -1 && milestone.order_index > firstIncompleteIndex,
    };
  });
}

export const getProjectWorkspaceView = cache(async (projectId: string, userId: string): Promise<ProjectWorkspaceView> => {
  const workspace = await getProjectWorkspace(projectId, userId);
  const projectTrack = workspace.project.project_track === "research" ? "research" : "software";
  const milestones = normalizeMilestones(workspace.milestones ?? []);
  const completedCount = milestones.filter((milestone) => milestone.completed).length;
  const completionPercent = milestones.length === 0 ? 0 : Math.round((completedCount / milestones.length) * 100);
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

  return {
    project: workspace.project,
    roadmap: workspace.roadmap,
    projectTrack,
    hasRoadmap: Boolean(workspace.roadmap),
    milestones,
    completedCount,
    completionPercent,
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
  };
});
