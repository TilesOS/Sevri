"use client";

import type { CSSProperties, FormEvent } from "react";
import { useDeferredValue, useEffect, useState } from "react";
import { CalendarScheduleRetryButton } from "@/components/calendar/calendar-schedule-retry-button";
import { getPlanLabel, trackThemes } from "@/components/theme/theme-utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addDaysToDateString,
  compareDateStrings,
  endOfCalendarGrid,
  endOfMonthDateString,
  formatDateForDisplay,
  formatMonthLabel,
  isDateString,
  listDateStringsInRange,
  startOfCalendarGrid,
  startOfMonthDateString,
} from "@/lib/calendar/date-utils";
import { buildCalendarExportEvents, buildGoogleCalendarUrl } from "@/lib/calendar/export";
import type {
  CalendarCompletionState,
  CalendarDisplayItem,
  CalendarMoveMode,
  CalendarUrgency,
  ScheduleGenerationSource,
} from "@/lib/calendar/types";
import type { CalendarPageView, CalendarProjectView } from "@/lib/db/queries/calendar";
import { cn } from "@/lib/utils";
import type { Plan, ProjectTrack } from "@/types/domain";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

interface CalendarPageClientProps {
  initialData: CalendarPageView;
  plan: Plan;
  canExport: boolean;
}

interface CalendarMutationProject {
  projectId: string;
  projectTitle: string;
  projectTrack: ProjectTrack;
  projectStatus: string;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  scheduleTimezone: string;
  scheduleGenerationSource: ScheduleGenerationSource | null;
  lastScheduleRebalancedAt: string | null;
  milestones: CalendarProjectView["milestones"];
  workSessions: CalendarProjectView["workSessions"];
}

interface CalendarMutationResponse {
  error?: string;
  code?: "deadline_extension_confirmation_required" | "deadline_extension_cooldown_active";
  message?: string;
  extension_number?: number;
  cooldown_ends_at?: string;
  project?: CalendarMutationProject;
  items?: CalendarDisplayItem[];
}

interface RescheduleDraft {
  item: CalendarDisplayItem;
  targetDate: string;
}

interface DeadlineMoveConfirmation {
  key: string;
  extensionNumber: number;
  message: string;
}

interface WorkSessionDraft {
  projectId: string;
  milestoneId: string;
  date: string;
  startTime: string;
  triggerContext: string;
  workDescription: string;
  location: string;
  durationMinutes: number;
}

function getClientTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatTimeForDisplay(value: string | undefined) {
  if (!value) {
    return "";
  }

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

function isProjectScheduleReady(project: {
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  milestones: ReadonlyArray<{
    dueDate: string | null;
    scheduleDurationDays: number | null;
  }>;
}) {
  if (!project.scheduledStartDate || !project.scheduledEndDate || project.milestones.length === 0) {
    return false;
  }

  return project.milestones.every(
    (milestone) => typeof milestone.dueDate === "string" && typeof milestone.scheduleDurationDays === "number",
  );
}

function resolveInitialSelectedDate(input: CalendarPageView) {
  const visibleProjectIds = new Set(input.visibleProjectIds);
  const visibleItems = input.projects
    .filter((project) => visibleProjectIds.has(project.projectId))
    .flatMap((project) => project.items);
  const defaultMonthKey = input.defaultMonth.slice(0, 7);

  if (input.today.startsWith(defaultMonthKey) && visibleItems.some((item) => item.date === input.today)) {
    return input.today;
  }

  const itemsInDefaultMonth = visibleItems
    .map((item) => item.date)
    .filter((date) => date.startsWith(defaultMonthKey))
    .sort((left, right) => left.localeCompare(right));

  if (itemsInDefaultMonth.length > 0) {
    return itemsInDefaultMonth[0];
  }

  const sortedDates = visibleItems.map((item) => item.date).sort((left, right) => left.localeCompare(right));
  return sortedDates[0] ?? startOfMonthDateString(input.defaultMonth);
}

function getStatusSurfaceClassName(status: CalendarCompletionState) {
  switch (status) {
    case "complete":
      return "border-line text-ink";
    case "in_progress":
      return "border-line text-ink";
    default:
      return "border-line bg-paper text-ink-soft";
  }
}

function getStatusSurfaceStyle(status: CalendarCompletionState): CSSProperties | undefined {
  switch (status) {
    case "complete":
      return { backgroundColor: 'rgba(91,208,214,0.18)', borderColor: 'rgba(91,208,214,0.5)' };
    case "in_progress":
      return { backgroundColor: 'rgba(255,217,61,0.18)', borderColor: 'rgba(255,217,61,0.5)' };
    default:
      return undefined;
  }
}

function getStatusTextClassName(status: CalendarCompletionState) {
  switch (status) {
    case "complete":
      return "text-ink";
    case "in_progress":
      return "text-ink";
    default:
      return "text-ink-soft";
  }
}

function getUrgencyTone(urgency: CalendarUrgency) {
  switch (urgency) {
    case "completed":
      return "success" as const;
    case "due_soon":
      return "warning" as const;
    case "overdue":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function getUrgencyLabel(urgency: CalendarUrgency) {
  switch (urgency) {
    case "completed":
      return "Completed";
    case "due_soon":
      return "Due soon";
    case "overdue":
      return "Overdue";
    default:
      return "On track";
  }
}

function getProjectSelection(
  projects: ReadonlyArray<CalendarProjectView>,
  visibleProjectIds: ReadonlyArray<string>,
  track: ProjectTrack,
) {
  const visibleSet = new Set(visibleProjectIds);
  return projects.filter((project) => project.projectTrack === track && visibleSet.has(project.projectId));
}

function getTrackSummaryLabel(
  projects: ReadonlyArray<CalendarProjectView>,
  visibleProjectIds: ReadonlyArray<string>,
  track: ProjectTrack,
) {
  const selectedCount = getProjectSelection(projects, visibleProjectIds, track).length;
  return `${selectedCount}/2 visible`;
}

function getProjectButtonClassName(selected: boolean) {
  return cn(
    "relative w-full min-w-0 rounded-2xl border px-4 py-4 text-left transition",
    selected ? "z-10 border-line-strong bg-paper shadow-soft" : "border-line bg-canvas/68 hover:border-line-strong hover:bg-paper",
  );
}

function sortItems(items: ReadonlyArray<CalendarDisplayItem>) {
  return [...items].sort((left, right) => {
    if (left.date !== right.date) {
      return compareDateStrings(left.date, right.date);
    }

    if ((left.startTime ?? "") !== (right.startTime ?? "")) {
      return (left.startTime ?? "").localeCompare(right.startTime ?? "");
    }

    if (left.projectTitle !== right.projectTitle) {
      return left.projectTitle.localeCompare(right.projectTitle);
    }

    if (left.stepNumber !== right.stepNumber) {
      return (left.stepNumber ?? 0) - (right.stepNumber ?? 0);
    }

    return left.title.localeCompare(right.title);
  });
}

function buildItemsByDate(items: ReadonlyArray<CalendarDisplayItem>) {
  const grouped = new Map<string, CalendarDisplayItem[]>();

  items.forEach((item) => {
    const bucket = grouped.get(item.date);
    if (bucket) {
      bucket.push(item);
      return;
    }

    grouped.set(item.date, [item]);
  });

  grouped.forEach((bucket, key) => {
    grouped.set(key, sortItems(bucket));
  });

  return grouped;
}

function toggleProjectId(
  projects: ReadonlyArray<CalendarProjectView>,
  visibleProjectIds: ReadonlyArray<string>,
  project: CalendarProjectView,
) {
  if (visibleProjectIds.includes(project.projectId)) {
    return visibleProjectIds.filter((id) => id !== project.projectId);
  }

  const trackVisibleIds = visibleProjectIds.filter((id) => {
    const candidate = projects.find((entry) => entry.projectId === id);
    return candidate?.projectTrack === project.projectTrack;
  });

  if (trackVisibleIds.length >= 2) {
    const [oldestTrackSelection] = trackVisibleIds;
    return [...visibleProjectIds.filter((id) => id !== oldestTrackSelection), project.projectId];
  }

  return [...visibleProjectIds, project.projectId];
}

function toCalendarProjectView(current: CalendarProjectView, update: CalendarMutationProject, items: CalendarDisplayItem[]) {
  return {
    ...current,
    projectTitle: update.projectTitle,
    projectTrack: update.projectTrack,
    projectStatus: update.projectStatus,
    scheduledStartDate: update.scheduledStartDate,
    scheduledEndDate: update.scheduledEndDate,
    scheduleTimezone: update.scheduleTimezone,
    scheduleGenerationSource: update.scheduleGenerationSource,
    lastScheduleRebalancedAt: update.lastScheduleRebalancedAt,
    milestones: update.milestones,
    workSessions: update.workSessions,
    scheduleReady: isProjectScheduleReady({
      scheduledStartDate: update.scheduledStartDate,
      scheduledEndDate: update.scheduledEndDate,
      milestones: update.milestones,
    }),
    items,
  } satisfies CalendarProjectView;
}

function getItemContextLabel(item: CalendarDisplayItem) {
  switch (item.itemType) {
    case "work_session":
      return item.stepNumber ? `Planned work - Step ${item.stepNumber}` : "Planned work";
    case "project_start":
      return "Project kickoff";
    case "project_end":
      return "Completion target";
    default:
      return `Step ${item.stepNumber}`;
  }
}

function getMoveSummaryLabel(item: CalendarDisplayItem) {
  switch (item.itemType) {
    case "project_start":
      return "Move kickoff only";
    case "project_end":
      return "Move completion target";
    default:
      return "Move only this step";
  }
}

function getItemChipLabel(item: CalendarDisplayItem) {
  switch (item.itemType) {
    case "work_session":
      return `${item.projectTitle} - ${formatTimeForDisplay(item.startTime)}`;
    case "project_start":
      return `${item.projectTitle} kickoff`;
    case "project_end":
      return `${item.projectTitle} finish`;
    default:
      return `${item.projectTitle} - Step ${item.stepNumber}`;
  }
}

function getMoveConfirmationKey(item: CalendarDisplayItem, targetDate: string, mode: CalendarMoveMode) {
  return `${item.id}:${mode}:${targetDate}`;
}

function buildInitialWorkSessionDraft(input: CalendarPageView, selectedDate: string): WorkSessionDraft {
  return {
    projectId: input.visibleProjectIds[0] ?? input.projects[0]?.projectId ?? "",
    milestoneId: "",
    date: selectedDate,
    startTime: "16:00",
    triggerContext: "",
    workDescription: "",
    location: "",
    durationMinutes: 30,
  };
}

function DayCell({
  date,
  currentMonth,
  today,
  selected,
  dropActive,
  items,
  onSelect,
  onDrop,
  onDragItemStart,
}: {
  date: string;
  currentMonth: string;
  today: string;
  selected: boolean;
  dropActive: boolean;
  items: CalendarDisplayItem[];
  onSelect: (date: string) => void;
  onDrop: (date: string) => void;
  onDragItemStart: (item: CalendarDisplayItem) => void;
}) {
  const isCurrentMonth = date.startsWith(currentMonth.slice(0, 7));
  const isToday = date === today;

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex min-h-[8.5rem] flex-col gap-2 border-r border-t border-line px-3 py-3 text-left transition focus-visible:outline-none",
        isCurrentMonth ? "bg-paper/92" : "bg-canvas/48 text-ink-muted",
        dropActive && "bg-surface-butter shadow-[inset_0_0_0_1px_rgba(81,126,95,0.3)]",
      )}
      style={selected ? { backgroundColor: 'rgba(91,208,214,0.14)', boxShadow: 'inset 0 0 0 2px rgba(91,208,214,0.5)' } : undefined}
      onClick={() => onSelect(date)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(date);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(date);
      }}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
          style={isToday ? { backgroundColor: 'var(--yellow)', color: 'var(--ink)', border: '2px solid var(--ink)' } : undefined}
        >
          {date.slice(8, 10).replace(/^0/, "")}
        </span>
        {items.length > 0 ? <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">{items.length}</span> : null}
      </div>

      <div className="space-y-2">
        {items.slice(0, 3).map((item) => (
          <button
            key={item.id}
            type="button"
            draggable={item.itemType !== "work_session"}
            onDragStart={(event) => {
              if (item.itemType === "work_session") {
                event.preventDefault();
                return;
              }

              event.stopPropagation();
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id);
              onDragItemStart(item);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(date);
            }}
            className={cn(
              "w-full rounded-xl border px-2.5 py-2 text-left text-[11px] font-medium leading-4 transition",
              getStatusSurfaceClassName(item.status),
            )}
            style={getStatusSurfaceStyle(item.status)}
            title={`${item.projectTitle} - ${item.title}`}
          >
            <p className="truncate">{getItemChipLabel(item)}</p>
            <p className={cn("mt-1 truncate text-[10px]", getStatusTextClassName(item.status))}>
              {item.itemType === "work_session" && item.durationMinutes
                ? `${item.durationMinutes} min - ${item.workDescription ?? item.title}`
                : item.title}
            </p>
          </button>
        ))}
        {items.length > 3 ? <p className="text-[11px] text-ink-muted">+{items.length - 3} more on this day</p> : null}
      </div>
    </div>
  );
}

const TRACK_HISTORY_LIMIT = 2;

function TrackSelector({
  track,
  projects,
  visibleProjectIds,
  expandedHistory,
  onToggleExpanded,
  onToggle,
}: {
  track: ProjectTrack;
  projects: CalendarProjectView[];
  visibleProjectIds: string[];
  expandedHistory: boolean;
  onToggleExpanded: () => void;
  onToggle: (project: CalendarProjectView) => void;
}) {
  const theme = trackThemes[track];
  const displayedProjects = expandedHistory ? projects : projects.slice(0, TRACK_HISTORY_LIMIT);
  const hiddenCount = projects.length - TRACK_HISTORY_LIMIT;

  return (
    <div className="min-w-0 space-y-3 rounded-[1.6rem] border border-line bg-canvas/72 p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Badge tone={theme.badgeTone}>{theme.label}</Badge>
          <span className="text-xs font-medium text-ink-muted">{getTrackSummaryLabel(projects, visibleProjectIds, track)}</span>
        </div>
        <span className="text-xs text-ink-muted">Swap which timelines stay in view.</span>
      </div>

      {projects.length > 0 ? (
        <div className="space-y-3">
          <div className="grid gap-3">
            {displayedProjects.map((project) => {
              const selected = visibleProjectIds.includes(project.projectId);
              return (
                <button
                  key={project.projectId}
                  type="button"
                  className={getProjectButtonClassName(selected)}
                  onClick={() => onToggle(project)}
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{project.projectTitle}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {project.scheduleReady
                          ? `${project.items.length} calendar items`
                          : "Roadmap is ready, but dates still need a schedule"}
                      </p>
                    </div>
                    <Badge tone={selected ? "accent" : "neutral"} className="shrink-0">
                      {selected ? "Visible" : "Hidden"}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={onToggleExpanded}
              className="w-full rounded-xl border border-line bg-canvas/48 px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-line-strong hover:bg-paper hover:text-ink"
            >
              {expandedHistory ? "Show less" : `Show ${hiddenCount} older ${hiddenCount === 1 ? "project" : "projects"}`}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-6 text-ink-muted">No {track} projects have a roadmap yet.</p>
      )}
    </div>
  );
}

export function CalendarPageClient({ initialData, plan, canExport }: CalendarPageClientProps) {
  const [data, setData] = useState(initialData);
  const [visibleProjectIds, setVisibleProjectIds] = useState(initialData.visibleProjectIds);
  const [currentMonth, setCurrentMonth] = useState(startOfMonthDateString(initialData.defaultMonth));
  const [selectedDate, setSelectedDate] = useState(resolveInitialSelectedDate(initialData));
  const [rescheduleDraft, setRescheduleDraft] = useState<RescheduleDraft | null>(null);
  const [dragItem, setDragItem] = useState<CalendarDisplayItem | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [deadlineMoveConfirmation, setDeadlineMoveConfirmation] = useState<DeadlineMoveConfirmation | null>(null);
  const [isSavingMove, setIsSavingMove] = useState(false);
  const [exportProjectId, setExportProjectId] = useState(initialData.visibleProjectIds[0] ?? initialData.projects[0]?.projectId ?? null);
  const [expandedSoftwareHistory, setExpandedSoftwareHistory] = useState(false);
  const [expandedResearchHistory, setExpandedResearchHistory] = useState(false);
  const [exportStepsExpanded, setExportStepsExpanded] = useState(false);
  const [workSessionDraft, setWorkSessionDraft] = useState(() =>
    buildInitialWorkSessionDraft(initialData, resolveInitialSelectedDate(initialData)),
  );
  const [workSessionError, setWorkSessionError] = useState<string | null>(null);
  const [isSavingWorkSession, setIsSavingWorkSession] = useState(false);
  const [deletingWorkSessionId, setDeletingWorkSessionId] = useState<string | null>(null);
  const deferredVisibleProjectIds = useDeferredValue(visibleProjectIds);

  useEffect(() => {
    const validIds = new Set(data.projects.map((project) => project.projectId));
    const sanitized = visibleProjectIds.filter((id) => validIds.has(id));
    if (sanitized.length !== visibleProjectIds.length) {
      setVisibleProjectIds(sanitized);
    }
  }, [data.projects, visibleProjectIds]);

  useEffect(() => {
    if (!exportProjectId) {
      const nextId = visibleProjectIds[0] ?? data.projects[0]?.projectId ?? null;
      if (nextId) {
        setExportProjectId(nextId);
      }
      return;
    }

    if (!data.projects.some((project) => project.projectId === exportProjectId)) {
      setExportProjectId(visibleProjectIds[0] ?? data.projects[0]?.projectId ?? null);
    }
  }, [data.projects, exportProjectId, visibleProjectIds]);

  useEffect(() => {
    setWorkSessionDraft((current) => ({ ...current, date: selectedDate }));
  }, [selectedDate]);

  useEffect(() => {
    const fallbackProjectId = visibleProjectIds[0] ?? data.projects[0]?.projectId ?? "";
    const selectedProjectExists = data.projects.some((project) => project.projectId === workSessionDraft.projectId);
    const selectedProjectVisible = visibleProjectIds.length === 0 || visibleProjectIds.includes(workSessionDraft.projectId);
    if (workSessionDraft.projectId && selectedProjectExists && selectedProjectVisible) {
      return;
    }

    setWorkSessionDraft((current) => ({
      ...current,
      projectId: fallbackProjectId,
      milestoneId: "",
    }));
  }, [data.projects, visibleProjectIds, workSessionDraft.projectId]);

  const visibleProjects = data.projects.filter((project) => deferredVisibleProjectIds.includes(project.projectId));
  const visibleItems = sortItems(visibleProjects.flatMap((project) => project.items));
  const itemsByDate = buildItemsByDate(visibleItems);
  const monthStart = startOfCalendarGrid(currentMonth);
  const monthEnd = endOfCalendarGrid(currentMonth);
  const visibleDates = listDateStringsInRange(monthStart, monthEnd);
  const dayItems = itemsByDate.get(selectedDate) ?? [];
  const overdueCount = visibleItems.filter((item) => item.urgency === "overdue").length;
  const dueSoonCount = visibleItems.filter((item) => item.urgency === "due_soon").length;
  const monthItemCount = visibleItems.filter(
    (item) =>
      compareDateStrings(item.date, startOfMonthDateString(currentMonth)) >= 0 &&
      compareDateStrings(item.date, endOfMonthDateString(currentMonth)) <= 0,
  ).length;
  const unscheduledProjects = visibleProjects.filter((project) => !project.scheduleReady);
  const softwareProjects = data.projects.filter((project) => project.projectTrack === "software");
  const researchProjects = data.projects.filter((project) => project.projectTrack === "research");
  const exportProject = visibleProjects.find((project) => project.projectId === exportProjectId)
    ?? data.projects.find((project) => project.projectId === exportProjectId)
    ?? visibleProjects[0]
    ?? data.projects[0]
    ?? null;
  const workSessionProjects = visibleProjects.length > 0 ? visibleProjects : data.projects;
  const workSessionProject = data.projects.find((project) => project.projectId === workSessionDraft.projectId)
    ?? workSessionProjects[0]
    ?? null;
  const workSessionMilestones = workSessionProject?.milestones ?? [];

  function applyProjectMutation(update: CalendarMutationProject, items: CalendarDisplayItem[]) {
    setData((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.projectId === update.projectId ? toCalendarProjectView(project, update, items) : project,
      ),
    }));
  }

  async function submitMove(mode: CalendarMoveMode) {
    if (!rescheduleDraft) {
      return;
    }

    if (!isDateString(rescheduleDraft.targetDate)) {
      setMoveError("Choose a valid target date.");
      return;
    }

    setIsSavingMove(true);
    setMoveError(null);
    const confirmationKey = getMoveConfirmationKey(rescheduleDraft.item, rescheduleDraft.targetDate, mode);
    const hasConfirmedDeadlineExtension = deadlineMoveConfirmation?.key === confirmationKey;

    const response = await fetch(`/api/projects/${rescheduleDraft.item.projectId}/calendar/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: rescheduleDraft.item.itemType,
        milestoneId: rescheduleDraft.item.itemType === "milestone" ? rescheduleDraft.item.id : undefined,
        targetDate: rescheduleDraft.targetDate,
        mode,
        timezone: getClientTimeZone(),
        deadlineExtensionConfirmed: hasConfirmedDeadlineExtension,
      }),
    });

    const body = (await response.json().catch(() => null)) as CalendarMutationResponse | null;

    if (!response.ok && body?.code === "deadline_extension_confirmation_required") {
      setDeadlineMoveConfirmation({
        key: confirmationKey,
        extensionNumber: body.extension_number ?? 1,
        message: body.message ?? "Confirm this later due date before saving.",
      });
      setMoveError(null);
      setIsSavingMove(false);
      return;
    }

    if (!response.ok && body?.code === "deadline_extension_cooldown_active") {
      setDeadlineMoveConfirmation(null);
      setMoveError(body.message ?? "Wait before moving this due date later again.");
      setIsSavingMove(false);
      return;
    }

    if (!response.ok || !body?.project || !body.items) {
      setMoveError(body?.error ?? body?.message ?? "Failed to update the calendar.");
      setIsSavingMove(false);
      return;
    }

    applyProjectMutation(body.project, body.items);
    setSelectedDate(rescheduleDraft.targetDate);
    setRescheduleDraft(null);
    setDragItem(null);
    setDeadlineMoveConfirmation(null);
    setIsSavingMove(false);
  }

  async function submitWorkSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workSessionDraft.projectId) {
      setWorkSessionError("Choose a project first.");
      return;
    }

    if (!isDateString(workSessionDraft.date)) {
      setWorkSessionError("Choose a valid date.");
      return;
    }

    if (!workSessionDraft.workDescription.trim()) {
      setWorkSessionError("Name the work you will do.");
      return;
    }

    setIsSavingWorkSession(true);
    setWorkSessionError(null);

    const response = await fetch(`/api/projects/${workSessionDraft.projectId}/calendar/work-sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        milestoneId: workSessionDraft.milestoneId || null,
        date: workSessionDraft.date,
        startTime: workSessionDraft.startTime,
        triggerContext: workSessionDraft.triggerContext,
        workDescription: workSessionDraft.workDescription,
        location: workSessionDraft.location,
        durationMinutes: workSessionDraft.durationMinutes,
        timezone: getClientTimeZone(),
      }),
    });
    const body = (await response.json().catch(() => null)) as CalendarMutationResponse | null;

    if (!response.ok || !body?.project || !body.items) {
      setWorkSessionError(body?.error ?? "Failed to plan work time.");
      setIsSavingWorkSession(false);
      return;
    }

    applyProjectMutation(body.project, body.items);
    setSelectedDate(workSessionDraft.date);
    setWorkSessionDraft((current) => ({
      ...current,
      milestoneId: "",
      triggerContext: "",
      workDescription: "",
      location: "",
      durationMinutes: 30,
    }));
    setIsSavingWorkSession(false);
  }

  async function deleteWorkSession(item: CalendarDisplayItem) {
    setDeletingWorkSessionId(item.id);
    setWorkSessionError(null);

    const response = await fetch(`/api/projects/${item.projectId}/calendar/work-sessions/${item.id}`, {
      method: "DELETE",
    });
    const body = (await response.json().catch(() => null)) as CalendarMutationResponse | null;

    if (!response.ok || !body?.project || !body.items) {
      setWorkSessionError(body?.error ?? "Failed to remove planned work time.");
      setDeletingWorkSessionId(null);
      return;
    }

    applyProjectMutation(body.project, body.items);
    setDeletingWorkSessionId(null);
  }

  function moveMonth(offsetDays: number) {
    const nextMonth = startOfMonthDateString(addDaysToDateString(currentMonth, offsetDays));
    setCurrentMonth(nextMonth);
    if (!selectedDate.startsWith(nextMonth.slice(0, 7))) {
      setSelectedDate(nextMonth);
    }
  }

  const moveOnlyConfirmationActive = rescheduleDraft
    ? deadlineMoveConfirmation?.key === getMoveConfirmationKey(rescheduleDraft.item, rescheduleDraft.targetDate, "move_only")
    : false;
  const rebalanceConfirmationActive = rescheduleDraft
    ? deadlineMoveConfirmation?.key === getMoveConfirmationKey(rescheduleDraft.item, rescheduleDraft.targetDate, "rebalance_downstream")
    : false;

  return (
    <div className="space-y-8 pb-10">
      <Card tone="contrast" className="border-contrast-line">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="contrast">{getPlanLabel(plan)}</Badge>
            <Badge tone="contrast">{visibleProjects.length} projects visible</Badge>
            <Badge tone="contrast">{monthItemCount} items this month</Badge>
          </div>
          <PageHeader
            eyebrow="Project calendar"
            title="See the roadmap as a finishable timeline."
            description="The calendar sits on top of your roadmap so due dates stay visible without changing the AI estimate behind each step."
            actions={
              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => moveMonth(-1)}>
                  Previous month
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    const todayMonth = startOfMonthDateString(initialData.today);
                    setCurrentMonth(todayMonth);
                    setSelectedDate(initialData.today);
                  }}
                >
                  Today
                </Button>
                <Button type="button" variant="outline" className="rounded-full" onClick={() => moveMonth(32)}>
                  Next month
                </Button>
              </div>
            }
            className="text-paper [&_.editorial-kicker]:text-paper/55 [&_h1]:text-paper [&_p]:text-paper/72"
          />
        </div>
      </Card>

      {data.projects.length === 0 ? (
        <Card className="space-y-4">
          <div className="space-y-2">
            <p className="editorial-kicker">No schedules yet</p>
            <h2 className="text-2xl font-semibold text-ink">Generate a roadmap first.</h2>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-ink-soft">
            Calendar dates appear as soon as a roadmap is created. Once a project has milestones, Sevri lays them out here automatically.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/dashboard" className="rounded-full">
              Open dashboard
            </Button>
            <Button href="/recommendations" variant="outline" className="rounded-full">
              Browse ideas
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_22rem]">
          <div className="min-w-0 space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card tone="butter" elevation="soft">
                <p className="editorial-kicker">Month in focus</p>
                <p className="mt-3 text-2xl font-semibold text-ink">{formatMonthLabel(currentMonth)}</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">Keep the roadmap legible at the project level before you worry about work blocks.</p>
              </Card>
              <Card tone={overdueCount > 0 ? "blush" : "primary"}>
                <p className="editorial-kicker">Attention needed</p>
                <p className="mt-3 text-2xl font-semibold text-ink">{overdueCount + dueSoonCount}</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">
                  {overdueCount > 0
                    ? `${overdueCount} overdue and ${dueSoonCount} due soon across visible projects.`
                    : `${dueSoonCount} items are due soon across visible projects.`}
                </p>
              </Card>
              <Card className="bg-surface-mint" elevation="soft">
                <p className="editorial-kicker">Source of truth</p>
                <p className="mt-3 text-lg font-semibold text-ink">Due dates update everywhere.</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">Dragging or moving a date here updates the step due date shown in guidance across Sevri.</p>
              </Card>
            </div>

            <Card padding="none" className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-6 py-5">
                <div className="space-y-1">
                  <p className="editorial-kicker">Month view</p>
                  <h2 className="text-2xl font-semibold text-ink">{formatMonthLabel(currentMonth)}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone="neutral">{visibleItems.length} scheduled items</Badge>
                  <Badge tone="warning">{dueSoonCount} due soon</Badge>
                  <Badge tone={overdueCount > 0 ? "danger" : "success"}>{overdueCount > 0 ? `${overdueCount} overdue` : "No overdue items"}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-line bg-canvas/72">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-7">
                {visibleDates.map((date) => (
                  <DayCell
                    key={date}
                    date={date}
                    currentMonth={currentMonth}
                    today={initialData.today}
                    selected={date === selectedDate}
                    dropActive={rescheduleDraft?.targetDate === date}
                    items={itemsByDate.get(date) ?? []}
                    onSelect={setSelectedDate}
                    onDrop={(targetDate) => {
                      if (!dragItem || dragItem.date === targetDate) {
                        return;
                      }

                      setRescheduleDraft({
                        item: dragItem,
                        targetDate,
                      });
                      setMoveError(null);
                      setDeadlineMoveConfirmation(null);
                      setSelectedDate(targetDate);
                    }}
                    onDragItemStart={(item) => {
                      setDragItem(item);
                      setMoveError(null);
                      setDeadlineMoveConfirmation(null);
                    }}
                  />
                ))}
              </div>
            </Card>

            {unscheduledProjects.length > 0 ? (
              <Alert tone="warning" heading="Some visible projects still need dates.">
                <div className="space-y-4">
                  <p>
                    The roadmap exists, but the schedule was not generated or needs another pass. You can rebuild the dates without touching the underlying AI time estimates.
                  </p>
                  <div className="grid gap-3">
                    {unscheduledProjects.map((project) => (
                      <div key={project.projectId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-ink">{project.projectTitle}</p>
                          <p className="text-xs text-ink-muted">{trackThemes[project.projectTrack].label} roadmap is ready, but dates are missing.</p>
                        </div>
                        <CalendarScheduleRetryButton projectId={project.projectId} className="rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              </Alert>
            ) : null}

            <Card className="min-w-0 space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-2">
                  <p className="editorial-kicker">Visible projects</p>
                  <h2 className="text-2xl font-semibold text-ink">Keep at most two software and two research projects in view.</h2>
                </div>
                <p className="max-w-xl text-sm leading-6 text-ink-soft">
                  Swap which timelines stay visible without turning the page into a cluttered project management wall.
                </p>
              </div>

              <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                <TrackSelector
                  track="software"
                  projects={softwareProjects}
                  visibleProjectIds={visibleProjectIds}
                  expandedHistory={expandedSoftwareHistory}
                  onToggleExpanded={() => setExpandedSoftwareHistory((prev) => !prev)}
                  onToggle={(project) => setVisibleProjectIds((current) => toggleProjectId(data.projects, current, project))}
                />
                <TrackSelector
                  track="research"
                  projects={researchProjects}
                  visibleProjectIds={visibleProjectIds}
                  expandedHistory={expandedResearchHistory}
                  onToggleExpanded={() => setExpandedResearchHistory((prev) => !prev)}
                  onToggle={(project) => setVisibleProjectIds((current) => toggleProjectId(data.projects, current, project))}
                />
              </div>
            </Card>
          </div>

          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <Card className="space-y-5">
              <div className="space-y-2">
                <p className="editorial-kicker">Plan work time</p>
                <h2 className="text-xl font-semibold text-ink">When this happens, I will do this work.</h2>
              </div>

              <form className="space-y-4" onSubmit={(event) => void submitWorkSession(event)}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-ink" htmlFor="work-session-project">
                    Project
                  </label>
                  <Select
                    id="work-session-project"
                    value={workSessionDraft.projectId}
                    onChange={(event) => {
                      setWorkSessionDraft((current) => ({
                        ...current,
                        projectId: event.target.value,
                        milestoneId: "",
                      }));
                      setWorkSessionError(null);
                    }}
                  >
                    {workSessionProjects.map((project) => (
                      <option key={project.projectId} value={project.projectId}>
                        {project.projectTitle}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-ink" htmlFor="work-session-step">
                    Step
                  </label>
                  <Select
                    id="work-session-step"
                    value={workSessionDraft.milestoneId}
                    onChange={(event) => {
                      setWorkSessionDraft((current) => ({ ...current, milestoneId: event.target.value }));
                      setWorkSessionError(null);
                    }}
                  >
                    <option value="">Whole project</option>
                    {workSessionMilestones.map((milestone) => (
                      <option key={milestone.id} value={milestone.id}>
                        Step {milestone.stepNumber}: {milestone.title}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-ink" htmlFor="work-session-date">
                      Date
                    </label>
                    <Input
                      id="work-session-date"
                      type="date"
                      value={workSessionDraft.date}
                      onChange={(event) => {
                        setWorkSessionDraft((current) => ({ ...current, date: event.target.value }));
                        setWorkSessionError(null);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-ink" htmlFor="work-session-time">
                      Time
                    </label>
                    <Input
                      id="work-session-time"
                      type="time"
                      value={workSessionDraft.startTime}
                      onChange={(event) => {
                        setWorkSessionDraft((current) => ({ ...current, startTime: event.target.value }));
                        setWorkSessionError(null);
                      }}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-ink" htmlFor="work-session-trigger">
                      When
                    </label>
                    <Input
                      id="work-session-trigger"
                      value={workSessionDraft.triggerContext}
                      onChange={(event) => {
                        setWorkSessionDraft((current) => ({ ...current, triggerContext: event.target.value }));
                        setWorkSessionError(null);
                      }}
                      placeholder="after calculus"
                      maxLength={160}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-ink" htmlFor="work-session-duration">
                      Minutes
                    </label>
                    <Input
                      id="work-session-duration"
                      type="number"
                      min={5}
                      max={480}
                      step={5}
                      value={workSessionDraft.durationMinutes}
                      onChange={(event) => {
                        setWorkSessionDraft((current) => ({
                          ...current,
                          durationMinutes: Number.parseInt(event.target.value, 10) || 30,
                        }));
                        setWorkSessionError(null);
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-ink" htmlFor="work-session-work">
                    I will
                  </label>
                  <Textarea
                    id="work-session-work"
                    value={workSessionDraft.workDescription}
                    onChange={(event) => {
                      setWorkSessionDraft((current) => ({ ...current, workDescription: event.target.value }));
                      setWorkSessionError(null);
                    }}
                    placeholder="work on the lit review"
                    maxLength={240}
                    className="min-h-24"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-ink" htmlFor="work-session-location">
                    Location
                  </label>
                  <Input
                    id="work-session-location"
                    value={workSessionDraft.location}
                    onChange={(event) => {
                      setWorkSessionDraft((current) => ({ ...current, location: event.target.value }));
                      setWorkSessionError(null);
                    }}
                    placeholder="library"
                    maxLength={120}
                  />
                </div>

                {workSessionError ? <Alert tone="danger">{workSessionError}</Alert> : null}

                <Button type="submit" className="w-full rounded-full" disabled={isSavingWorkSession || !workSessionProject}>
                  {isSavingWorkSession ? "Saving..." : "Plan work block"}
                </Button>
              </form>
            </Card>

            <Card className="space-y-5">
              <div className="space-y-2">
                <p className="editorial-kicker">Selected day</p>
                <h2 className="text-2xl font-semibold text-ink">
                  {formatDateForDisplay(selectedDate, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h2>
              </div>

              {dayItems.length > 0 ? (
                <div className="space-y-3">
                  {dayItems.map((item) => (
                    <div key={item.id} className={cn("rounded-[1.4rem] border px-4 py-4", getStatusSurfaceClassName(item.status))} style={getStatusSurfaceStyle(item.status)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={trackThemes[item.projectTrack].badgeTone}>{trackThemes[item.projectTrack].label}</Badge>
                        <Badge tone={getUrgencyTone(item.urgency)}>{getUrgencyLabel(item.urgency)}</Badge>
                        {item.isUserScheduledOverride ? <Badge tone="neutral">Manual move</Badge> : null}
                      </div>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-semibold text-ink">{item.projectTitle}</p>
                        <div className="space-y-1">
                          <p className="text-base font-semibold text-ink">{item.title}</p>
                          <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">{getItemContextLabel(item)}</p>
                        </div>
                        {item.itemType === "work_session" ? (
                          <div className="flex flex-wrap gap-2">
                            {item.startTime ? <Badge tone="neutral">{formatTimeForDisplay(item.startTime)}</Badge> : null}
                            {item.durationMinutes ? <Badge tone="neutral">{item.durationMinutes} min</Badge> : null}
                            {item.triggerContext ? <Badge tone="neutral">{item.triggerContext}</Badge> : null}
                            {item.location ? <Badge tone="neutral">{item.location}</Badge> : null}
                          </div>
                        ) : null}
                        <p className={cn("text-sm leading-6", getStatusTextClassName(item.status))}>{item.description}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button href={item.href} variant="outline" size="sm" className="rounded-full">
                          Open in workspace
                        </Button>
                        {item.itemType === "work_session" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-full"
                            onClick={() => void deleteWorkSession(item)}
                            disabled={deletingWorkSessionId === item.id}
                          >
                            {deletingWorkSessionId === item.id ? "Removing..." : "Remove"}
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-full"
                            onClick={() => {
                              setRescheduleDraft({
                                item,
                                targetDate: item.date,
                              });
                              setMoveError(null);
                              setDeadlineMoveConfirmation(null);
                            }}
                          >
                            Move date
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-ink-soft">
                  Nothing lands on this day for the visible projects. Use the month grid to inspect nearby due dates or drag an item here to reschedule it.
                </p>
              )}
            </Card>

            <Card className="space-y-4">
              <div className="space-y-2">
                <p className="editorial-kicker">Legend</p>
                <h2 className="text-xl font-semibold text-ink">Completion is the main signal. Risk stays secondary.</h2>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-paper shadow-[inset_0_0_0_1px_rgba(163,173,168,0.9)]" />
                  <span className="text-sm text-ink-soft">Not started</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3" style={{ backgroundColor: 'rgba(255,217,61,0.12)' }}>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--yellow)', border: '1px solid rgba(22,20,18,0.3)' }} />
                  <span className="text-sm text-ink">In progress</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-line px-4 py-3" style={{ backgroundColor: 'rgba(91,208,214,0.12)' }}>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: 'var(--cyan)', border: '1px solid rgba(22,20,18,0.3)' }} />
                  <span className="text-sm text-ink">Completed</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="neutral">On track</Badge>
                <Badge tone="warning">Due soon</Badge>
                <Badge tone="danger">Overdue</Badge>
                <Badge tone="success">Completed</Badge>
              </div>
            </Card>

            <Card className="space-y-5">
              <div className="space-y-2">
                <p className="editorial-kicker">Export</p>
                <h2 className="text-xl font-semibold text-ink">Send a project schedule out without turning on sync.</h2>
                <p className="text-sm leading-6 text-ink-soft">
                  Exports are one-way in v1. Editing dates in Sevri continues to update the source-of-truth due dates here in the app.
                </p>
              </div>

              {canExport ? (
                exportProject ? (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {visibleProjects.map((project) => (
                        <button
                          key={project.projectId}
                          type="button"
                          className={cn(
                            "rounded-full border px-3 py-2 text-xs font-semibold transition",
                            exportProject.projectId === project.projectId
                              ? "border-line-strong bg-paper text-ink"
                              : "border-line bg-canvas/72 text-ink-soft hover:border-line-strong hover:bg-paper",
                          )}
                          onClick={() => setExportProjectId(project.projectId)}
                        >
                          {project.projectTitle}
                        </button>
                      ))}
                    </div>

                    {exportProject.scheduleReady ? (
                      <>
                        <div className="rounded-[1.4rem] border border-line bg-canvas/72 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-ink">{exportProject.projectTitle}</p>
                              <p className="text-xs text-ink-muted">{buildCalendarExportEvents(exportProject.items).length} all-day events ready to export.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExportStepsExpanded((prev) => !prev)}
                                className="rounded-full border border-line bg-canvas/72 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-line-strong hover:bg-paper hover:text-ink"
                              >
                                {exportStepsExpanded ? "Hide steps" : "Show steps"}
                              </button>
                              <Button
                                href={`/api/projects/${exportProject.projectId}/calendar/export/ics`}
                                variant="outline"
                                size="sm"
                                className="rounded-full"
                              >
                                Download .ics
                              </Button>
                            </div>
                          </div>
                        </div>

                        {exportStepsExpanded ? (
                          <div className="space-y-3">
                            {buildCalendarExportEvents(exportProject.items).map((event) => (
                              <a
                                key={event.uid}
                                href={buildGoogleCalendarUrl(event)}
                                target="_blank"
                                rel="noreferrer"
                                className="block rounded-2xl border border-line bg-paper px-4 py-3 transition hover:border-line-strong hover:bg-canvas/72"
                              >
                                <p className="text-sm font-semibold text-ink">{event.title}</p>
                                <p className="mt-1 text-xs text-ink-muted">
                                  {formatDateForDisplay(event.date, { month: "short", day: "numeric", year: "numeric" })}
                                </p>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="space-y-3 rounded-[1.4rem] border border-line bg-canvas/72 p-4">
                        <p className="text-sm text-ink-soft">Dates need to be rebuilt before this project can be exported.</p>
                        <CalendarScheduleRetryButton projectId={exportProject.projectId} className="rounded-full" />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-ink-soft">Choose a visible project to export.</p>
                )
              ) : (
                <div className="space-y-4 rounded-[1.4rem] border border-line bg-canvas/72 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="warning">Pro only</Badge>
                    <Badge tone="neutral">{getPlanLabel(plan)}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-ink-soft">
                    Calendar exports stay behind Pro. Free users can still plan and reschedule everything inside Sevri.
                  </p>
                  <Button href="/settings/billing" variant="outline" className="rounded-full">
                    Upgrade to Pro
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {rescheduleDraft ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/26 px-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl space-y-5 shadow-lifted">
            <div className="space-y-2">
              <p className="editorial-kicker">Move date</p>
              <h2 className="text-2xl font-semibold text-ink">{rescheduleDraft.item.title}</h2>
              <p className="text-sm leading-6 text-ink-soft">
                The AI time estimate stays intact. This only changes the scheduled date that Sevri uses across the app.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-canvas/72 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-ink-muted">Current date</p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {formatDateForDisplay(rescheduleDraft.item.date, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-ink" htmlFor="calendar-target-date">
                  New date
                </label>
                <Input
                  id="calendar-target-date"
                  type="date"
                  value={rescheduleDraft.targetDate}
                  onChange={(event) => {
                    setRescheduleDraft((current) => (current ? { ...current, targetDate: event.target.value } : current));
                    setMoveError(null);
                    setDeadlineMoveConfirmation(null);
                  }}
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-canvas/72 p-4">
              <p className="text-sm font-semibold text-ink">How should Sevri handle the rest of the timeline?</p>
              <p className="text-sm leading-6 text-ink-soft">
                Choose whether this is a local exception or whether downstream dates should be respaced while preserving step order and duration assumptions.
              </p>
            </div>

            {deadlineMoveConfirmation ? (
              <Alert tone="warning" heading={`Postponement ${deadlineMoveConfirmation.extensionNumber}`}>
                {deadlineMoveConfirmation.message}
              </Alert>
            ) : null}

            {moveError ? <Alert tone="danger">{moveError}</Alert> : null}

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="rounded-full"
                onClick={() => {
                  setRescheduleDraft(null);
                  setDragItem(null);
                  setMoveError(null);
                  setDeadlineMoveConfirmation(null);
                }}
                disabled={isSavingMove}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => void submitMove("move_only")}
                disabled={isSavingMove}
              >
                {isSavingMove
                  ? "Saving..."
                  : moveOnlyConfirmationActive
                    ? "Confirm postponement"
                    : getMoveSummaryLabel(rescheduleDraft.item)}
              </Button>
              {rescheduleDraft.item.itemType !== "project_end" ? (
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => void submitMove("rebalance_downstream")}
                  disabled={isSavingMove}
                >
                  {isSavingMove ? "Saving..." : rebalanceConfirmationActive ? "Confirm postponement" : "Rebalance downstream"}
                </Button>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
