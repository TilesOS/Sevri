import { differenceInCalendarDays } from "./date-utils.ts";
import type { CalendarUrgency } from "./types.ts";

export function deriveUrgencyState(input: {
  completed: boolean;
  date: string;
  today: string;
}) {
  if (input.completed) {
    return "completed" satisfies CalendarUrgency;
  }

  const daysUntilDue = differenceInCalendarDays(input.date, input.today);
  if (daysUntilDue < 0) {
    return "overdue" satisfies CalendarUrgency;
  }

  if (daysUntilDue <= 3) {
    return "due_soon" satisfies CalendarUrgency;
  }

  return "on_track" satisfies CalendarUrgency;
}
