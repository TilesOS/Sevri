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
  percent: number;
  items: ProjectProgressItem[];
}

interface ProjectProgressInput {
  hasProject?: boolean;
  hasRoadmap: boolean;
  completedCount: number;
  totalMilestones: number;
  projectStatus?: string | null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
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
    stageDetail = stepProgressDetail;
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
      detail: stepProgressDetail,
      state: stage === "step_work" ? "current" : allStepsComplete ? "complete" : "locked",
    },
    {
      id: "shipped",
      label: "Shipped",
      detail: "Ready to present",
      state: shipped ? "complete" : "locked",
    },
  ];

  const completedStages = items.filter((item) => item.state === "complete").length;
  const partialStepCredit =
    input.hasRoadmap && totalMilestones > 0 && !allStepsComplete ? completedCount / totalMilestones : 0;
  const percent = clampPercent(((completedStages + partialStepCredit) / items.length) * 100);

  return {
    stage,
    stageLabel,
    stageDetail,
    percent,
    items,
  };
}
