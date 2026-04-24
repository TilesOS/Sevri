export type MilestoneProgressState = "complete" | "in_progress" | "not_started";

export interface MilestoneProgressInput {
  order_index?: number;
  orderIndex?: number;
  completed: boolean;
}

export interface MilestoneProgressMeta {
  status: MilestoneProgressState;
  isFuture: boolean;
  firstIncompleteIndex: number;
}

function getOrderIndex(milestone: MilestoneProgressInput) {
  if (typeof milestone.order_index === "number") {
    return milestone.order_index;
  }

  if (typeof milestone.orderIndex === "number") {
    return milestone.orderIndex;
  }

  throw new Error("Milestone order index is missing.");
}

export function deriveMilestoneProgressMeta(
  milestones: ReadonlyArray<MilestoneProgressInput>,
  orderIndex: number,
): MilestoneProgressMeta {
  const firstIncompleteIndex = milestones.findIndex((milestone) => !milestone.completed);
  const currentMilestone = milestones.find((milestone) => getOrderIndex(milestone) === orderIndex);

  if (!currentMilestone) {
    throw new Error(`Milestone ${orderIndex} not found.`);
  }

  const status: MilestoneProgressState = currentMilestone.completed
    ? "complete"
    : firstIncompleteIndex === -1 || getOrderIndex(currentMilestone) === firstIncompleteIndex
      ? "in_progress"
      : "not_started";

  return {
    status,
    isFuture: !currentMilestone.completed && firstIncompleteIndex !== -1 && getOrderIndex(currentMilestone) > firstIncompleteIndex,
    firstIncompleteIndex,
  };
}
