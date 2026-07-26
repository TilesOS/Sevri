// The single source of truth for "how far along is this project?".
//
// Two separate facts are reported and must never be blended:
//   - `percent`    — completed steps / total steps. Nothing else counts.
//   - `stage`      — the lifecycle label (Ideating → … → Shipped).
// An earlier version folded lifecycle stages into the percentage, which made the
// same project read 72% on the dashboard and 60% in the Portfolio. Every surface
// now reads `percent` from here.

export type ProjectProgressStage = "ideating" | "chosen" | "scoped" | "step_work" | "shipped";
export type ProjectProgressItemState = "complete" | "current" | "locked";

export interface ProjectProgressItem {
  id: ProjectProgressStage;
  label: string;
  detail: string;
  state: ProjectProgressItemState;
}

export interface ProjectProgressSummary {
  stage: ProjectProgressStage;
  stageLabel: string;
  stageDetail: string;
  /** Completed steps / total steps, 0-100. Zero-step projects are 0. */
  percent: number;
  completedSteps: number;
  totalSteps: number;
  /** The sentence that belongs next to `percent` — same fact, written out. */
  percentDetail: string;
  items: ProjectProgressItem[];
}

interface ProjectProgressInput {
  hasProject?: boolean;
  hasRoadmap: boolean;
  completedCount: number;
  totalMilestones: number;
  projectStatus?: string | null;
}

/**
 * The one progress percentage. Completed steps over total steps; a project with
 * no steps yet is 0%, never a partial credit for having reached a lifecycle stage.
 */
export function getProjectProgressPercent(completedSteps: number, totalSteps: number): number {
  const total = Math.max(0, Math.floor(totalSteps));
  if (total === 0) {
    return 0;
  }

  const completed = Math.max(0, Math.min(Math.floor(completedSteps), total));
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)));
}

export function getProjectProgressSummary(input: ProjectProgressInput): ProjectProgressSummary {
  const hasProject = input.hasProject ?? true;
  const totalMilestones = Math.max(0, input.totalMilestones);
  const completedCount = Math.max(0, Math.min(input.completedCount, totalMilestones));
  const allStepsComplete = totalMilestones > 0 && completedCount === totalMilestones;
  const shipped = input.projectStatus === "completed" || allStepsComplete;
  const currentStepNumber = totalMilestones === 0 ? 0 : Math.min(completedCount + 1, totalMilestones);
  const stepProgressDetail =
    totalMilestones > 0
      ? `${completedCount} of ${totalMilestones} project steps complete`
      : "Project steps appear after the roadmap is generated";
  const percent = getProjectProgressPercent(completedCount, totalMilestones);

  let stage: ProjectProgressStage;
  let stageLabel: string;
  let stageDetail: string;

  if (!hasProject) {
    stage = "ideating";
    stageLabel = "Ideating";
    stageDetail = "Compare three generated options and choose the strongest direction.";
  } else if (!input.hasRoadmap) {
    stage = "chosen";
    stageLabel = "Direction chosen";
    stageDetail = "Generate the project overview and roadmap to lock the scoped version.";
  } else if (shipped) {
    stage = "shipped";
    stageLabel = "Completed / shipped";
    stageDetail = "Every roadmap step is complete. The project is ready to present.";
  } else if (completedCount === 0) {
    stage = "scoped";
    stageLabel = "Scoped";
    stageDetail = "The overview is ready. Start Step 1 to turn the scope into visible work.";
  } else {
    stage = "step_work";
    stageLabel = `Step ${currentStepNumber} of ${totalMilestones}`;
    // Deliberately not the step count: that fact already belongs to `percent`
    // and `percentDetail`, and repeating it makes two numbers for one thing.
    stageDetail = `Finish Step ${currentStepNumber}'s deliverable before opening the next one.`;
  }

  const items: ProjectProgressItem[] = [
    {
      id: "ideating",
      label: "Ideating",
      detail: "Three options generated",
      state: stage === "ideating" ? "current" : hasProject ? "complete" : "locked",
    },
    {
      id: "chosen",
      label: "Chosen",
      detail: "Project selected",
      state: stage === "chosen" ? "current" : hasProject ? "complete" : "locked",
    },
    {
      id: "scoped",
      label: "Scoped",
      detail: "Overview and roadmap ready",
      state: stage === "scoped" ? "current" : input.hasRoadmap ? "complete" : "locked",
    },
    {
      id: "step_work",
      label: totalMilestones > 0 ? `Steps ${completedCount}/${totalMilestones}` : "Steps",
      detail:
        totalMilestones > 0
          ? "One concrete deliverable per step"
          : "Steps appear after the roadmap is generated",
      state: stage === "step_work" ? "current" : allStepsComplete ? "complete" : "locked",
    },
    {
      id: "shipped",
      label: "Shipped",
      detail: "Ready to present",
      state: shipped ? "complete" : "locked",
    },
  ];

  return {
    stage,
    stageLabel,
    stageDetail,
    percent,
    completedSteps: completedCount,
    totalSteps: totalMilestones,
    percentDetail: stepProgressDetail,
    items,
  };
}
