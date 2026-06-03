import { getTodayDateString } from "@/lib/calendar/date-utils";
import { buildProjectCalendarItems } from "@/lib/calendar/items";
import type {
  CalendarCompletionState,
  CalendarDisplayItem,
  CalendarUrgency,
  CalendarWorkSession,
  ProjectScheduleState,
  ScheduleGenerationSource,
  ScheduleMilestoneInput,
} from "@/lib/calendar/types";
import { deriveUrgencyState } from "@/lib/calendar/urgency";
import { deriveMilestoneProgressMeta } from "@/lib/projects/milestone-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProjectTrack } from "@/types/domain";

function asProjectTrack(value: unknown): ProjectTrack {
  return value === "research" ? "research" : "software";
}

function asScheduleSource(value: unknown): ScheduleGenerationSource | null {
  if (
    value === "roadmap_generation" ||
    value === "manual_regenerate" ||
    value === "rebalance_downstream" ||
    value === "move_only"
  ) {
    return value;
  }

  return null;
}

export interface CalendarMilestoneView extends ScheduleMilestoneInput {
  status: CalendarCompletionState;
  urgency: CalendarUrgency | null;
}

export interface CalendarProjectView extends ProjectScheduleState {
  selectedAt: string;
  scheduleReady: boolean;
  milestones: CalendarMilestoneView[];
  items: CalendarDisplayItem[];
}

export interface CalendarPageView {
  today: string;
  defaultMonth: string;
  visibleProjectIds: string[];
  projects: CalendarProjectView[];
}

export interface ProjectScheduleGenerationContext extends ProjectScheduleState {
  estimatedWeeks: number;
  weeklyHours: number | null;
}

function groupByProjectId<T extends { project_id: string }>(rows: ReadonlyArray<T>) {
  return rows.reduce<Record<string, T[]>>((accumulator, row) => {
    if (!accumulator[row.project_id]) {
      accumulator[row.project_id] = [];
    }

    accumulator[row.project_id].push(row);
    return accumulator;
  }, {});
}

function buildMilestoneViews(input: {
  projectId: string;
  milestones: Array<{
    id: string;
    project_id: string;
    order_index: number;
    title: string;
    rough_time_estimate: string | null;
    due_date: string | null;
    schedule_duration_days: number | null;
    is_user_scheduled_override: boolean;
    completed: boolean;
  }>;
  today: string;
}) {
  const ordered = [...input.milestones].sort((left, right) => left.order_index - right.order_index);

  return ordered.map((milestone) => {
    const progress = deriveMilestoneProgressMeta(ordered, milestone.order_index);
    return {
      id: milestone.id,
      orderIndex: milestone.order_index,
      stepNumber: milestone.order_index + 1,
      title: milestone.title,
      roughTimeEstimate: milestone.rough_time_estimate,
      dueDate: milestone.due_date,
      scheduleDurationDays: milestone.schedule_duration_days,
      completed: milestone.completed,
      isUserScheduledOverride: milestone.is_user_scheduled_override,
      status: progress.status,
      urgency: milestone.due_date
        ? deriveUrgencyState({
            completed: milestone.completed,
            date: milestone.due_date,
            today: input.today,
          })
        : null,
    } satisfies CalendarMilestoneView;
  });
}

function isScheduleReady(project: {
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  milestones: ReadonlyArray<Pick<CalendarMilestoneView, "dueDate" | "scheduleDurationDays">>;
}) {
  if (!project.scheduledStartDate || !project.scheduledEndDate || project.milestones.length === 0) {
    return false;
  }

  return project.milestones.every((milestone) => milestone.dueDate && milestone.scheduleDurationDays);
}

function normalizeTimeString(value: string | null) {
  return (value ?? "00:00").slice(0, 5);
}

function buildWorkSessionViews(input: {
  sessions: Array<{
    id: string;
    project_id: string;
    milestone_id: string | null;
    local_date: string;
    local_time: string | null;
    schedule_timezone: string | null;
    trigger_context: string | null;
    work_description: string;
    location: string | null;
    duration_minutes: number;
    completed_at: string | null;
    created_at: string;
  }>;
  milestones: ReadonlyArray<CalendarMilestoneView>;
}) {
  const stepNumberByMilestoneId = new Map(input.milestones.map((milestone) => [milestone.id, milestone.stepNumber]));

  return input.sessions
    .map((session) => ({
      id: session.id,
      projectId: session.project_id,
      milestoneId: session.milestone_id,
      stepNumber: session.milestone_id ? stepNumberByMilestoneId.get(session.milestone_id) ?? null : null,
      date: session.local_date,
      startTime: normalizeTimeString(session.local_time),
      scheduleTimezone: session.schedule_timezone ?? "UTC",
      triggerContext: session.trigger_context ?? "",
      workDescription: session.work_description,
      location: session.location,
      durationMinutes: session.duration_minutes,
      completedAt: session.completed_at,
      createdAt: session.created_at,
    } satisfies CalendarWorkSession))
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }

      return left.startTime.localeCompare(right.startTime);
    });
}

function getVisibleProjectIds(projects: ReadonlyArray<CalendarProjectView>) {
  const trackPriority: Array<ProjectTrack> = ["software", "research"];
  const selected: string[] = [];

  trackPriority.forEach((track) => {
    const preferred = projects
      .filter((project) => project.projectTrack === track)
      .sort((left, right) => {
        const leftPriority = left.projectStatus === "completed" ? 1 : 0;
        const rightPriority = right.projectStatus === "completed" ? 1 : 0;
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return right.selectedAt.localeCompare(left.selectedAt);
      })
      .slice(0, 1);

    preferred.forEach((project) => {
      selected.push(project.projectId);
    });
  });

  return selected;
}

export async function getCalendarPageData(userId: string): Promise<CalendarPageView> {
  const supabase = await createServerSupabaseClient();
  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id, title, status, project_track, selected_at")
    .eq("user_id", userId)
    .in("status", ["active", "paused", "completed"])
    .order("selected_at", { ascending: false });

  if (projectError) {
    throw new Error(`Failed to fetch calendar projects: ${projectError.message}`);
  }

  const projectIds = (projects ?? []).map((project) => project.id);
  if (projectIds.length === 0) {
    const today = getTodayDateString("UTC");
    return {
      today,
      defaultMonth: today,
      visibleProjectIds: [],
      projects: [],
    };
  }

  const [
    { data: roadmaps, error: roadmapError },
    { data: milestones, error: milestoneError },
    { data: workSessions, error: workSessionError },
  ] = await Promise.all([
    supabase
      .from("project_roadmaps")
      .select(
        "project_id, scheduled_start_date, scheduled_end_date, schedule_timezone, schedule_generation_source, last_schedule_rebalanced_at",
      )
      .in("project_id", projectIds),
    supabase
      .from("milestones")
      .select(
        "id, project_id, order_index, title, rough_time_estimate, due_date, schedule_duration_days, is_user_scheduled_override, completed",
      )
      .in("project_id", projectIds)
      .order("order_index", { ascending: true }),
    supabase
      .from("project_work_sessions")
      .select(
        "id, project_id, milestone_id, local_date, local_time, schedule_timezone, trigger_context, work_description, location, duration_minutes, completed_at, created_at",
      )
      .in("project_id", projectIds)
      .order("local_date", { ascending: true })
      .order("local_time", { ascending: true }),
  ]);

  if (roadmapError) {
    throw new Error(`Failed to fetch calendar roadmaps: ${roadmapError.message}`);
  }

  if (milestoneError) {
    throw new Error(`Failed to fetch calendar milestones: ${milestoneError.message}`);
  }

  if (workSessionError) {
    throw new Error(`Failed to fetch planned work sessions: ${workSessionError.message}`);
  }

  const roadmapByProjectId = new Map((roadmaps ?? []).map((roadmap) => [roadmap.project_id, roadmap]));
  const milestonesByProjectId = groupByProjectId(milestones ?? []);
  const workSessionsByProjectId = groupByProjectId(workSessions ?? []);
  const calendarProjects = (projects ?? [])
    .filter((project) => roadmapByProjectId.has(project.id))
    .map((project) => {
      const roadmap = roadmapByProjectId.get(project.id);
      if (!roadmap) {
        throw new Error(`Roadmap missing for project ${project.id}`);
      }

      const today = getTodayDateString(roadmap.schedule_timezone ?? "UTC");
      const milestoneViews = buildMilestoneViews({
        projectId: project.id,
        milestones: milestonesByProjectId[project.id] ?? [],
        today,
      });
      const sessionViews = buildWorkSessionViews({
        sessions: workSessionsByProjectId[project.id] ?? [],
        milestones: milestoneViews,
      });
      const scheduleState: ProjectScheduleState = {
        projectId: project.id,
        projectTitle: project.title,
        projectTrack: asProjectTrack(project.project_track),
        projectStatus: project.status,
        scheduledStartDate: roadmap.scheduled_start_date,
        scheduledEndDate: roadmap.scheduled_end_date,
        scheduleTimezone: roadmap.schedule_timezone ?? "UTC",
        scheduleGenerationSource: asScheduleSource(roadmap.schedule_generation_source),
        lastScheduleRebalancedAt: roadmap.last_schedule_rebalanced_at,
        milestones: milestoneViews,
        workSessions: sessionViews,
      };

      return {
        ...scheduleState,
        selectedAt: project.selected_at,
        scheduleReady: isScheduleReady({
          scheduledStartDate: scheduleState.scheduledStartDate,
          scheduledEndDate: scheduleState.scheduledEndDate,
          milestones: milestoneViews,
        }),
        milestones: milestoneViews,
        items: buildProjectCalendarItems({
          project: scheduleState,
          today,
        }),
      } satisfies CalendarProjectView;
    });

  const fallbackToday = getTodayDateString("UTC");
  const defaultMonth =
    calendarProjects.find((project) => project.scheduleReady)?.scheduledStartDate ??
    calendarProjects[0]?.selectedAt?.slice(0, 10) ??
    fallbackToday;

  return {
    today: fallbackToday,
    defaultMonth,
    visibleProjectIds: getVisibleProjectIds(calendarProjects),
    projects: calendarProjects,
  };
}

export async function getProjectScheduleGenerationContext(
  projectId: string,
  userId: string,
): Promise<ProjectScheduleGenerationContext> {
  const supabase = await createServerSupabaseClient();
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title, status, project_track, recommendation_id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message ?? "Project not found.");
  }

  const [
    { data: roadmap, error: roadmapError },
    { data: milestones, error: milestoneError },
    { data: recommendation, error: recommendationError },
    { data: workSessions, error: workSessionError },
  ] =
    await Promise.all([
      supabase
        .from("project_roadmaps")
        .select(
          "project_id, scheduled_start_date, scheduled_end_date, schedule_timezone, schedule_generation_source, last_schedule_rebalanced_at",
        )
        .eq("project_id", projectId)
        .single(),
      supabase
        .from("milestones")
        .select(
          "id, project_id, order_index, title, rough_time_estimate, due_date, schedule_duration_days, is_user_scheduled_override, completed",
        )
        .eq("project_id", projectId)
        .order("order_index", { ascending: true }),
      supabase
        .from("project_recommendations")
        .select("estimated_weeks, weekly_hours")
        .eq("id", project.recommendation_id)
        .single(),
      supabase
        .from("project_work_sessions")
        .select(
          "id, project_id, milestone_id, local_date, local_time, schedule_timezone, trigger_context, work_description, location, duration_minutes, completed_at, created_at",
        )
        .eq("project_id", projectId)
        .order("local_date", { ascending: true })
        .order("local_time", { ascending: true }),
    ]);

  if (roadmapError || !roadmap) {
    throw new Error(roadmapError?.message ?? "Roadmap not found.");
  }

  if (milestoneError) {
    throw new Error(`Failed to fetch project milestones: ${milestoneError.message}`);
  }

  if (recommendationError || !recommendation) {
    throw new Error(recommendationError?.message ?? "Recommendation not found.");
  }

  if (workSessionError) {
    throw new Error(`Failed to fetch planned work sessions: ${workSessionError.message}`);
  }

  const milestoneViews = buildMilestoneViews({
    projectId,
    milestones: milestones ?? [],
    today: getTodayDateString(roadmap.schedule_timezone ?? "UTC"),
  });

  return {
    projectId: project.id,
    projectTitle: project.title,
    projectTrack: asProjectTrack(project.project_track),
    projectStatus: project.status,
    scheduledStartDate: roadmap.scheduled_start_date,
    scheduledEndDate: roadmap.scheduled_end_date,
    scheduleTimezone: roadmap.schedule_timezone ?? "UTC",
    scheduleGenerationSource: asScheduleSource(roadmap.schedule_generation_source),
    lastScheduleRebalancedAt: roadmap.last_schedule_rebalanced_at,
    estimatedWeeks: recommendation.estimated_weeks,
    weeklyHours: recommendation.weekly_hours,
    milestones: milestoneViews,
    workSessions: buildWorkSessionViews({
      sessions: workSessions ?? [],
      milestones: milestoneViews,
    }),
  };
}
