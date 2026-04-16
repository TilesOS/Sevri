export interface StepGuidanceGateInput {
  order_index: number;
  completed: boolean;
}

export interface StepGuidanceGate {
  guidanceLocked: boolean;
  previousStepNumber: number | null;
}

export function getStepGuidanceGate(
  milestones: ReadonlyArray<StepGuidanceGateInput>,
  currentOrderIndex: number,
): StepGuidanceGate {
  if (currentOrderIndex <= 0) {
    return {
      guidanceLocked: false,
      previousStepNumber: null,
    };
  }

  const previousStepNumber = currentOrderIndex;
  const previousMilestone = milestones.find((milestone) => milestone.order_index === currentOrderIndex - 1);

  if (!previousMilestone) {
    return {
      guidanceLocked: true,
      previousStepNumber,
    };
  }

  return {
    guidanceLocked: !previousMilestone.completed,
    previousStepNumber,
  };
}
