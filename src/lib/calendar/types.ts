import type { ProjectTrack } from "@/types/domain";

export type ScheduleGenerationSource =
  | "roadmap_generation"
  | "manual_regenerate"
  | "rebalance_downstream"
  | "move_only";

export type CalendarItemType = "project_start" | "milestone" | "project_end" | "work_session";
export type CalendarMoveMode = "move_only" | "rebalance_downstream";
export type CalendarCompletionState = "not_started" | "in_progress" | "complete";
export type CalendarUrgency = "on_track" | "due_soon" | "overdue" | "completed";

export interface ScheduleMilestoneInput {
  id: string;
  orderIndex: number;
  stepNumber: number;
  title: string;
  roughTimeEstimate: string | null;
  dueDate: string | null;
  scheduleDurationDays: number | null;
  completed: boolean;
  isUserScheduledOverride: boolean;
}

export interface ScheduledMilestoneUpdate {
  id: string;
  dueDate: string;
  scheduleDurationDays: number;
  isUserScheduledOverride: boolean;
}

export interface GeneratedProjectSchedule {
  scheduledStartDate: string;
  scheduledEndDate: string;
  scheduleTimezone: string;
  milestones: ScheduledMilestoneUpdate[];
}

export interface ProjectScheduleState {
  projectId: string;
  projectTitle: string;
  projectTrack: ProjectTrack;
  projectStatus: string;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  scheduleTimezone: string;
  scheduleGenerationSource: ScheduleGenerationSource | null;
  lastScheduleRebalancedAt: string | null;
  milestones: ScheduleMilestoneInput[];
  workSessions: CalendarWorkSession[];
}

export interface CalendarWorkSession {
  id: string;
  projectId: string;
  milestoneId: string | null;
  stepNumber: number | null;
  date: string;
  startTime: string;
  scheduleTimezone: string;
  triggerContext: string;
  workDescription: string;
  location: string | null;
  durationMinutes: number;
  completedAt: string | null;
  createdAt: string;
}

export interface CalendarDisplayItem {
  id: string;
  projectId: string;
  projectTitle: string;
  projectTrack: ProjectTrack;
  itemType: CalendarItemType;
  title: string;
  date: string;
  status: CalendarCompletionState;
  urgency: CalendarUrgency;
  stepNumber: number | null;
  startTime?: string;
  scheduleTimezone?: string;
  durationMinutes?: number;
  triggerContext?: string;
  workDescription?: string;
  location?: string | null;
  completedAt?: string | null;
  isUserScheduledOverride: boolean;
  href: string;
  description: string;
}
