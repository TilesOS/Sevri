import { addDaysToDateString, compareDateStrings, getTodayDateString } from "./date-utils.ts";
import type { CalendarItemType, CalendarMoveMode } from "./types.ts";

export const DEADLINE_EXTENSION_WARNING_LIMIT = 2;
export const DEADLINE_EXTENSION_COOLDOWN_DAYS = 2;

export type DeadlineExtensionItemType = Extract<CalendarItemType, "milestone" | "project_end">;

export interface DeadlineExtensionHistory {
  extensionCount: number;
  latestExtensionCreatedAt: string | null;
}

export type DeadlineExtensionDecision =
  | { status: "not_extension" }
  | {
      status: "confirmation_required";
      extensionNumber: number;
      message: string;
    }
  | {
      status: "cooldown_active";
      extensionNumber: number;
      cooldownEndsAt: string;
      message: string;
    }
  | {
      status: "allowed";
      extensionNumber: number;
      message: string;
    };

export interface DeadlineExtensionEventInput {
  userId: string;
  projectId: string;
  itemType: DeadlineExtensionItemType;
  milestoneId: string | null;
  previousDate: string;
  requestedDate: string;
  moveMode: CalendarMoveMode;
  extensionNumber: number;
}

function getExtensionLabel(extensionNumber: number) {
  if (extensionNumber === 1) return "first";
  if (extensionNumber === 2) return "second";
  if (extensionNumber === 3) return "third";
  return `${extensionNumber}th`;
}

function buildConfirmationMessage(extensionNumber: number) {
  if (extensionNumber <= DEADLINE_EXTENSION_WARNING_LIMIT) {
    return `This is the ${getExtensionLabel(extensionNumber)} time this due date is moving later. Confirm that this protects the finished project, not just the pressure of starting.`;
  }

  return "You can move this due date later now, but Sevri will add another short cooldown afterward. Use the extra time for a smaller, shippable version of the work.";
}

export function getDeadlineExtensionDecision(input: {
  currentDate: string;
  targetDate: string;
  history: DeadlineExtensionHistory;
  now?: Date;
  confirmed: boolean;
  timeZone?: string | null;
}): DeadlineExtensionDecision {
  if (compareDateStrings(input.targetDate, input.currentDate) <= 0) {
    return { status: "not_extension" };
  }

  const extensionNumber = input.history.extensionCount + 1;
  const now = input.now ?? new Date();

  if (extensionNumber > DEADLINE_EXTENSION_WARNING_LIMIT && input.history.latestExtensionCreatedAt) {
    const latestDate = getTodayDateString(input.timeZone ?? "UTC", new Date(input.history.latestExtensionCreatedAt));
    const cooldownEndsAt = addDaysToDateString(latestDate, DEADLINE_EXTENSION_COOLDOWN_DAYS);
    const today = getTodayDateString(input.timeZone ?? "UTC", now);

    if (compareDateStrings(today, cooldownEndsAt) < 0) {
      return {
        status: "cooldown_active",
        extensionNumber,
        cooldownEndsAt,
        message: `Pause before pushing this date back again. The next extension unlocks on ${cooldownEndsAt}; meanwhile, choose the smallest version you can ship by the current date.`,
      };
    }
  }

  const message = buildConfirmationMessage(extensionNumber);

  if (!input.confirmed) {
    return {
      status: "confirmation_required",
      extensionNumber,
      message,
    };
  }

  return {
    status: "allowed",
    extensionNumber,
    message,
  };
}
