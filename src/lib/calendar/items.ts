import { getTodayDateString } from "@/lib/calendar/date-utils";
import { deriveUrgencyState } from "@/lib/calendar/urgency";
import type {
  CalendarCompletionState,
  CalendarDisplayItem,
  CalendarWorkSession,
  ProjectScheduleState,
  ScheduleMilestoneInput,
} from "@/lib/calendar/types";
import { deriveMilestoneProgressMeta } from "@/lib/projects/milestone-status";

function asCalendarStatus(value: "complete" | "in_progress" | "not_started"): CalendarCompletionState {
  return value;
}

function buildMilestoneDescription(input: {
  projectTitle: string;
  stepNumber: number;
  milestoneTitle: string;
  dueDate: string;
}) {
  return `${input.projectTitle} - Step ${input.stepNumber} is due on ${input.dueDate}: ${input.milestoneTitle}.`;
}

function buildProjectBoundaryDescription(input: {
  projectTitle: string;
  label: "Kickoff" | "Completion target";
  date: string;
}) {
  return `${input.projectTitle} - ${input.label} on ${input.date}.`;
}

function formatSessionTime(value: string) {
  const [hourPart, minutePart] = value.split(":");
  const hour = Number.parseInt(hourPart ?? "", 10);
  const minute = Number.parseInt(minutePart ?? "", 10);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return value;
  }

  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function buildWorkSessionTitle(session: CalendarWorkSession) {
  return `${session.durationMinutes} min: ${session.workDescription}`;
}

function buildWorkSessionDescription(input: {
  projectTitle: string;
  session: CalendarWorkSession;
}) {
  const context = input.session.triggerContext.trim();
  const location = input.session.location?.trim();
  const stepLabel = input.session.stepNumber ? ` Step ${input.session.stepNumber}.` : "";
  const when = `${input.session.date} at ${formatSessionTime(input.session.startTime)}`;
  const contextPhrase = context ? `, ${context}` : "";
  const locationPhrase = location ? ` at ${location}` : "";

  return `${input.projectTitle} - When ${when}${contextPhrase}, I will spend ${input.session.durationMinutes} min on ${input.session.workDescription}${locationPhrase}.${stepLabel}`;
}

function getProjectEndStatus(input: {
  projectStatus: string;
  milestones: ReadonlyArray<ScheduleMilestoneInput>;
}) {
  if (input.projectStatus === "completed" || input.milestones.every((milestone) => milestone.completed)) {
    return "complete" satisfies CalendarCompletionState;
  }

  const progressStates = input.milestones.map((milestone) =>
    deriveMilestoneProgressMeta(input.milestones, milestone.orderIndex).status,
  );
  if (progressStates.some((status) => status !== "not_started")) {
    return "in_progress" satisfies CalendarCompletionState;
  }

  return "not_started" satisfies CalendarCompletionState;
}

export function buildProjectCalendarItems(input: {
  project: ProjectScheduleState;
  today?: string;
}) {
  const today = input.today ?? getTodayDateString(input.project.scheduleTimezone);
  const milestones = [...input.project.milestones].sort((left, right) => left.orderIndex - right.orderIndex);
  const items: CalendarDisplayItem[] = [];
  const progressStates = milestones.map((milestone) => deriveMilestoneProgressMeta(milestones, milestone.orderIndex).status);
  const projectStartStatus = progressStates.some((status) => status !== "not_started")
    ? "complete"
    : "not_started";

  if (input.project.scheduledStartDate) {
    items.push({
      id: `${input.project.projectId}:start`,
      projectId: input.project.projectId,
      projectTitle: input.project.projectTitle,
      projectKindLabel: input.project.projectKindLabel,
      itemType: "project_start",
      title: `${input.project.projectTitle} kickoff`,
      date: input.project.scheduledStartDate,
      status: projectStartStatus,
      urgency: deriveUrgencyState({
        completed: projectStartStatus === "complete",
        date: input.project.scheduledStartDate,
        today,
      }),
      stepNumber: null,
      isUserScheduledOverride: false,
      href: `/project/${input.project.projectId}`,
      description: buildProjectBoundaryDescription({
        projectTitle: input.project.projectTitle,
        label: "Kickoff",
        date: input.project.scheduledStartDate,
      }),
    });
  }

  milestones.forEach((milestone) => {
    if (!milestone.dueDate) {
      return;
    }

    const progress = deriveMilestoneProgressMeta(milestones, milestone.orderIndex);
    const status = asCalendarStatus(progress.status);
    items.push({
      id: milestone.id,
      projectId: input.project.projectId,
      projectTitle: input.project.projectTitle,
      projectKindLabel: input.project.projectKindLabel,
      itemType: "milestone",
      title: `Step ${milestone.stepNumber}: ${milestone.title}`,
      date: milestone.dueDate,
      status,
      urgency: deriveUrgencyState({
        completed: milestone.completed,
        date: milestone.dueDate,
        today,
      }),
      stepNumber: milestone.stepNumber,
      isUserScheduledOverride: milestone.isUserScheduledOverride,
      href: `/project/${input.project.projectId}/steps/${milestone.stepNumber}`,
      description: buildMilestoneDescription({
        projectTitle: input.project.projectTitle,
        stepNumber: milestone.stepNumber,
        milestoneTitle: milestone.title,
        dueDate: milestone.dueDate,
      }),
    });
  });

  if (input.project.scheduledEndDate) {
    const status = getProjectEndStatus({
      projectStatus: input.project.projectStatus,
      milestones,
    });
    items.push({
      id: `${input.project.projectId}:end`,
      projectId: input.project.projectId,
      projectTitle: input.project.projectTitle,
      projectKindLabel: input.project.projectKindLabel,
      itemType: "project_end",
      title: `${input.project.projectTitle} completion target`,
      date: input.project.scheduledEndDate,
      status,
      urgency: deriveUrgencyState({
        completed: status === "complete",
        date: input.project.scheduledEndDate,
        today,
      }),
      stepNumber: null,
      isUserScheduledOverride: false,
      href: `/project/${input.project.projectId}`,
      description: buildProjectBoundaryDescription({
        projectTitle: input.project.projectTitle,
        label: "Completion target",
        date: input.project.scheduledEndDate,
      }),
    });
  }

  input.project.workSessions.forEach((session) => {
    const title = buildWorkSessionTitle(session);
    items.push({
      id: session.id,
      projectId: input.project.projectId,
      projectTitle: input.project.projectTitle,
      projectKindLabel: input.project.projectKindLabel,
      itemType: "work_session",
      title,
      date: session.date,
      status: session.completedAt ? "complete" : "not_started",
      urgency: deriveUrgencyState({
        completed: Boolean(session.completedAt),
        date: session.date,
        today,
      }),
      stepNumber: session.stepNumber,
      startTime: session.startTime,
      scheduleTimezone: session.scheduleTimezone,
      durationMinutes: session.durationMinutes,
      triggerContext: session.triggerContext,
      workDescription: session.workDescription,
      location: session.location,
      completedAt: session.completedAt,
      isUserScheduledOverride: false,
      href: session.stepNumber
        ? `/project/${input.project.projectId}/steps/${session.stepNumber}`
        : `/project/${input.project.projectId}`,
      description: buildWorkSessionDescription({
        projectTitle: input.project.projectTitle,
        session,
      }),
    });
  });

  return items.sort((left, right) => {
    if (left.date === right.date) {
      if ((left.startTime ?? "") !== (right.startTime ?? "")) {
        return (left.startTime ?? "").localeCompare(right.startTime ?? "");
      }

      if (left.itemType === right.itemType) {
        return left.title.localeCompare(right.title);
      }

      if (left.itemType === "project_start") {
        return -1;
      }

      if (right.itemType === "project_start") {
        return 1;
      }

      if (left.itemType === "project_end") {
        return 1;
      }

      if (right.itemType === "project_end") {
        return -1;
      }
    }

    return left.date.localeCompare(right.date);
  });
}
