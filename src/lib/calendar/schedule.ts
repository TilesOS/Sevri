import { addDaysToDateString, compareDateStrings, getTodayDateString, normalizeTimeZone } from "./date-utils.ts";
import { buildFallbackDurationDays, parseRoughTimeEstimateDays } from "./estimates.ts";
import type {
  CalendarItemType,
  GeneratedProjectSchedule,
  ProjectScheduleState,
  ScheduleMilestoneInput,
} from "./types.ts";
import type { ProjectTrack } from "@/types/domain";

function sortMilestones(milestones: ReadonlyArray<ScheduleMilestoneInput>) {
  return [...milestones].sort((left, right) => left.orderIndex - right.orderIndex);
}

function getFallbackDurationDaysForExistingSchedule(input: {
  milestones: ReadonlyArray<ScheduleMilestoneInput>;
  projectTrack: ProjectTrack;
}) {
  return buildFallbackDurationDays({
    estimatedWeeks: Math.max(input.milestones.length, 1),
    stepCount: input.milestones.length,
    weeklyHours: 6,
    projectTrack: input.projectTrack,
  });
}

function resolveDurationDays(
  milestone: Pick<ScheduleMilestoneInput, "roughTimeEstimate" | "scheduleDurationDays">,
  fallbackDurationDays: number,
) {
  return (
    milestone.scheduleDurationDays ??
    parseRoughTimeEstimateDays(milestone.roughTimeEstimate) ??
    fallbackDurationDays
  );
}

function validateProjectStartMove(targetDate: string, firstMilestoneDate: string | null) {
  if (firstMilestoneDate && compareDateStrings(targetDate, firstMilestoneDate) > 0) {
    throw new Error("Project start cannot move after the first scheduled step.");
  }
}

function validateProjectEndMove(targetDate: string, lastMilestoneDate: string | null) {
  if (lastMilestoneDate && compareDateStrings(targetDate, lastMilestoneDate) < 0) {
    throw new Error("Project completion cannot move before the final scheduled step.");
  }
}

export function generateProjectSchedule(input: {
  milestones: ReadonlyArray<ScheduleMilestoneInput>;
  estimatedWeeks: number;
  weeklyHours?: number | null;
  projectTrack: ProjectTrack;
  timeZone?: string | null;
  startDate?: string | null;
}): GeneratedProjectSchedule {
  const milestones = sortMilestones(input.milestones);
  const scheduleTimezone = normalizeTimeZone(input.timeZone);
  const fallbackDurationDays = buildFallbackDurationDays({
    estimatedWeeks: input.estimatedWeeks,
    stepCount: milestones.length,
    weeklyHours: input.weeklyHours,
    projectTrack: input.projectTrack,
  });
  const scheduledStartDate = input.startDate ?? getTodayDateString(scheduleTimezone);

  let cursor = scheduledStartDate;
  const updates = milestones.map((milestone) => {
    const scheduleDurationDays = resolveDurationDays(milestone, fallbackDurationDays);
    const dueDate = addDaysToDateString(cursor, Math.max(scheduleDurationDays - 1, 0));
    cursor = addDaysToDateString(dueDate, 1);

    return {
      id: milestone.id,
      dueDate,
      scheduleDurationDays,
      isUserScheduledOverride: false,
    };
  });

  return {
    scheduledStartDate,
    scheduledEndDate: updates[updates.length - 1]?.dueDate ?? scheduledStartDate,
    scheduleTimezone,
    milestones: updates,
  };
}

export function applyMoveOnly(input: {
  project: ProjectScheduleState;
  itemType: CalendarItemType;
  targetDate: string;
  milestoneId?: string | null;
}) {
  const milestones = sortMilestones(input.project.milestones);
  const firstDueDate = milestones[0]?.dueDate ?? null;
  const lastDueDate = milestones[milestones.length - 1]?.dueDate ?? null;

  if (input.itemType === "project_start") {
    validateProjectStartMove(input.targetDate, firstDueDate);
    return {
      scheduledStartDate: input.targetDate,
      scheduledEndDate: input.project.scheduledEndDate ?? lastDueDate ?? input.targetDate,
      milestones: [] as Array<{
        id: string;
        dueDate: string;
        scheduleDurationDays: number;
        isUserScheduledOverride: boolean;
      }>,
    };
  }

  if (input.itemType === "project_end") {
    validateProjectEndMove(input.targetDate, lastDueDate);
    return {
      scheduledStartDate: input.project.scheduledStartDate,
      scheduledEndDate: input.targetDate,
      milestones: [] as Array<{
        id: string;
        dueDate: string;
        scheduleDurationDays: number;
        isUserScheduledOverride: boolean;
      }>,
    };
  }

  const milestoneIndex = milestones.findIndex((milestone) => milestone.id === input.milestoneId);
  if (milestoneIndex === -1) {
    throw new Error("Scheduled step not found.");
  }

  const currentMilestone = milestones[milestoneIndex];
  const previousBoundary = milestoneIndex === 0 ? input.project.scheduledStartDate : milestones[milestoneIndex - 1]?.dueDate ?? null;
  const nextBoundary = milestones[milestoneIndex + 1]?.dueDate ?? null;

  if (previousBoundary && compareDateStrings(input.targetDate, previousBoundary) < 0) {
    throw new Error("A step cannot move before the prior scheduled boundary.");
  }

  if (nextBoundary && compareDateStrings(input.targetDate, nextBoundary) > 0) {
    throw new Error("A step cannot move after the next scheduled step without rebalancing.");
  }

  const scheduleDurationDays = resolveDurationDays(
    currentMilestone,
    getFallbackDurationDaysForExistingSchedule({
      milestones,
      projectTrack: input.project.projectTrack,
    }),
  );
  const scheduledEndDate =
    milestoneIndex === milestones.length - 1
      ? compareDateStrings(input.project.scheduledEndDate ?? input.targetDate, input.targetDate) < 0
        ? input.targetDate
        : input.project.scheduledEndDate
      : input.project.scheduledEndDate;

  return {
    scheduledStartDate: input.project.scheduledStartDate,
    scheduledEndDate,
    milestones: [
      {
        id: currentMilestone.id,
        dueDate: input.targetDate,
        scheduleDurationDays,
        isUserScheduledOverride: true,
      },
    ],
  };
}

export function applyRebalanceDownstream(input: {
  project: ProjectScheduleState;
  itemType: Exclude<CalendarItemType, "project_end">;
  targetDate: string;
  milestoneId?: string | null;
}) {
  const milestones = sortMilestones(input.project.milestones);

  if (input.itemType === "project_start") {
    const regenerated = generateProjectSchedule({
      milestones,
      estimatedWeeks: Math.max(milestones.length, 1),
      projectTrack: input.project.projectTrack,
      timeZone: input.project.scheduleTimezone,
      startDate: input.targetDate,
    });

    return {
      scheduledStartDate: regenerated.scheduledStartDate,
      scheduledEndDate: regenerated.scheduledEndDate,
      milestones: regenerated.milestones,
    };
  }

  const milestoneIndex = milestones.findIndex((milestone) => milestone.id === input.milestoneId);
  if (milestoneIndex === -1) {
    throw new Error("Scheduled step not found.");
  }

  const previousBoundary = milestoneIndex === 0 ? input.project.scheduledStartDate : milestones[milestoneIndex - 1]?.dueDate ?? null;
  if (previousBoundary && compareDateStrings(input.targetDate, previousBoundary) < 0) {
    throw new Error("A step cannot move before the prior scheduled boundary.");
  }

  const fallbackDurationDays = getFallbackDurationDaysForExistingSchedule({
    milestones,
    projectTrack: input.project.projectTrack,
  });

  const updates: Array<{
    id: string;
    dueDate: string;
    scheduleDurationDays: number;
    isUserScheduledOverride: boolean;
  }> = [];

  let cursor = addDaysToDateString(input.targetDate, 1);
  milestones.forEach((milestone, index) => {
    if (index < milestoneIndex) {
      return;
    }

    const scheduleDurationDays = resolveDurationDays(milestone, fallbackDurationDays);
    if (index === milestoneIndex) {
      updates.push({
        id: milestone.id,
        dueDate: input.targetDate,
        scheduleDurationDays,
        isUserScheduledOverride: true,
      });
      cursor = addDaysToDateString(input.targetDate, 1);
      return;
    }

    const dueDate = addDaysToDateString(cursor, Math.max(scheduleDurationDays - 1, 0));
    updates.push({
      id: milestone.id,
      dueDate,
      scheduleDurationDays,
      isUserScheduledOverride: false,
    });
    cursor = addDaysToDateString(dueDate, 1);
  });

  return {
    scheduledStartDate: input.project.scheduledStartDate,
    scheduledEndDate: updates[updates.length - 1]?.dueDate ?? input.project.scheduledEndDate ?? input.targetDate,
    milestones: updates,
  };
}
