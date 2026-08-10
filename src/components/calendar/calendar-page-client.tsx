"use client";

import type { FormEvent } from "react";
import { useDeferredValue, useEffect, useState } from "react";
import { CalendarScheduleRetryButton } from "@/components/calendar/calendar-schedule-retry-button";
import { getPlanLabel } from "@/components/theme/theme-utils";
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
import { toUserFacingError } from "@/lib/errors/user-messages";
import { cn } from "@/lib/utils";
import type { Plan } from "@/types/domain";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Chips a day cell shows before collapsing the rest behind a "+N more" control. */
const VISIBLE_CHIPS_PER_DAY = 3;

interface CalendarPageClientProps {
  initialData: CalendarPageView;
  plan: Plan;
  canExport: boolean;
}

interface CalendarMutationProject {
  projectId: string;
  projectTitle: string;
  projectKindLabel: string;
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

/**
 * Today as the browser sees it. The server computes `today` in UTC, which is a
 * day ahead for anyone west of Greenwich during their evening — enough to
 * highlight the wrong cell and open the wrong month around a rollover.
 */
function getBrowserToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getClientTimeZone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return isDateString(parts) ? parts : null;
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

function getStatusSurfaceClassName(status: CalendarCompletionState) {
  switch (status) {
    case "complete":
      return "border-teal-deep/20 bg-teal/10 text-ink";
    case "in_progress":
      return "border-navy/15 bg-navy/[0.06] text-ink";
    default:
      return "border-line bg-paper text-ink-soft";
  }
}

function getStatusTextClassName(status: CalendarCompletionState) {
  switch (status) {
    case "complete":
      return "text-ink-soft";
    case "in_progress":
      return "text-navy";
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

const PROJECT_COLOR_CLASSES = [
  { dot: "bg-teal-deep", selected: "border-teal-deep/30 bg-teal/10" },
  { dot: "bg-coral", selected: "border-coral/30 bg-primary-soft" },
  { dot: "bg-navy", selected: "border-navy/25 bg-navy/[0.06]" },
  { dot: "bg-amber-500", selected: "border-amber-500/30 bg-amber-50" },
] as const;
function getProjectColor(projectId: string) {
  const hash = Array.from(projectId).reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 0);
  return PROJECT_COLOR_CLASSES[hash % PROJECT_COLOR_CLASSES.length];
}
function getProjectButtonClassName(selected: boolean, projectId: string) {
  return cn(
    "relative w-full min-w-0 rounded-lg border px-4 py-3 text-left transition",
    selected
      ? `z-10 shadow-soft ${getProjectColor(projectId).selected}`
      : "border-line bg-paper/70 hover:border-line-strong hover:bg-paper",
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

  if (visibleProjectIds.length >= 4) {
    const [oldestSelection] = visibleProjectIds;
    return [...visibleProjectIds.filter((id) => id !== oldestSelection), project.projectId];
  }

  return [...visibleProjectIds, project.projectId];
}

function toCalendarProjectView(current: CalendarProjectView, update: CalendarMutationProject, items: CalendarDisplayItem[]) {
  return {
    ...current,
    projectTitle: update.projectTitle,
    projectKindLabel: update.projectKindLabel,
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
  const weekdayLabel = WEEKDAY_LABELS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  const dayLabel = formatDateForDisplay(date, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={cn(
        // overflow-hidden is the hard guarantee that nothing in this cell can be
        // drawn over a neighbouring day, whatever a chip's label turns out to be.
        "relative grid min-h-[4.75rem] min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-2 overflow-hidden border-b border-line px-3 py-2.5 text-left transition",
        // sm:items-stretch matters: with the inherited `items-start` a column
        // flex container sizes children to their content, so a long chip made the
        // list wider than the cell and it spilled into the next day.
        "sm:flex sm:min-h-[7.5rem] sm:flex-col sm:items-stretch sm:gap-2 sm:border-b-0 sm:border-r sm:border-t sm:px-2.5 sm:py-2.5 lg:min-h-[8rem]",
        isCurrentMonth ? "bg-paper" : "hidden bg-surface/45 text-ink-muted sm:flex",
        selected && "bg-primary-soft ring-1 ring-inset ring-primary/40",
        dropActive && "bg-teal/10 ring-1 ring-inset ring-teal-deep/30",
      )}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(date);
      }}
    >
      <button
        type="button"
        className="flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-center focus-visible:outline-none sm:min-h-0 sm:w-auto sm:flex-row sm:justify-between sm:gap-2 sm:text-left"
        onClick={() => onSelect(date)}
        aria-pressed={selected}
        aria-current={isToday ? "date" : undefined}
        aria-label={`${dayLabel}, ${items.length} ${items.length === 1 ? "item" : "items"}`}
      >
        <span
          className={cn(
            "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
            isToday ? "bg-primary text-primary-foreground shadow-soft" : "text-ink",
            !isCurrentMonth && !isToday && "text-ink-muted",
          )}
        >
          {date.slice(8, 10).replace(/^0/, "")}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted sm:hidden">
          {weekdayLabel}
        </span>
        {items.length > 0 ? (
          <span className="ml-auto hidden text-[10px] font-medium tabular-nums text-ink-muted sm:inline">
            {items.length}
          </span>
        ) : null}
      </button>

      <div className="w-full min-w-0 space-y-1.5">
        {items.slice(0, VISIBLE_CHIPS_PER_DAY).map((item) => (
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
            onClick={() => {
              onSelect(date);
            }}
            className={cn(
              "block w-full min-w-0 max-w-full overflow-hidden rounded-md border px-2 py-1.5 text-left text-[11px] font-medium leading-4 transition hover:border-line-strong",
              getStatusSurfaceClassName(item.status),
              item.itemType === "work_session" && item.completedAt && "opacity-60",
            )}
            title={`${item.projectTitle} - ${item.title}`}
          >
            <p className="truncate">
              {item.itemType === "work_session" && item.completedAt ? "✓ " : ""}
              {getItemChipLabel(item)}
            </p>
            <p className={cn("truncate text-[10px]", getStatusTextClassName(item.status))}>
              {item.itemType === "work_session" && item.durationMinutes
                ? `${item.durationMinutes} min - ${item.workDescription ?? item.title}`
                : item.title}
            </p>
          </button>
        ))}
        {items.length > VISIBLE_CHIPS_PER_DAY ? (
          // Actionable rather than decorative: selecting the day opens the panel
          // that lists every item, so nothing clipped here is unreachable.
          <button
            type="button"
            onClick={() => onSelect(date)}
            className="block w-full truncate rounded-md px-1 py-0.5 text-left text-[10px] font-medium text-ink-muted transition hover:text-ink"
          >
            +{items.length - VISIBLE_CHIPS_PER_DAY} more
          </button>
        ) : null}
      </div>
    </div>
  );
}

const PROJECT_HISTORY_LIMIT = 6;

function ProjectSelector({
  projects,
  visibleProjectIds,
  expandedHistory,
  onToggleExpanded,
  onToggle,
}: {
  projects: CalendarProjectView[];
  visibleProjectIds: string[];
  expandedHistory: boolean;
  onToggleExpanded: () => void;
  onToggle: (project: CalendarProjectView) => void;
}) {
  const displayedProjects = expandedHistory ? projects : projects.slice(0, PROJECT_HISTORY_LIMIT);
  const hiddenCount = projects.length - PROJECT_HISTORY_LIMIT;

  return (
    <div className="min-w-0 space-y-3 rounded-xl border border-line bg-surface/50 p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">Project timelines</span>
        <span className="text-xs font-medium text-ink-muted">{visibleProjectIds.length}/4 visible</span>
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
                  className={getProjectButtonClassName(selected, project.projectId)}
                  onClick={() => onToggle(project)}
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink"><span className={`h-2 w-2 shrink-0 rounded-full ${getProjectColor(project.projectId).dot}`} />{project.projectTitle}</p>
                      <p className="mt-1 truncate text-xs font-medium text-primary">{project.projectKindLabel}</p>
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
              className="w-full rounded-lg border border-line bg-paper/70 px-3 py-2 text-xs font-medium text-ink-muted transition hover:border-line-strong hover:bg-paper hover:text-ink"
            >
              {expandedHistory ? "Show less" : `Show ${hiddenCount} older ${hiddenCount === 1 ? "project" : "projects"}`}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-6 text-ink-muted">No projects have a roadmap yet.</p>
      )}
    </div>
  );
}

export function CalendarPageClient({ initialData, plan, canExport }: CalendarPageClientProps) {
  const [data, setData] = useState(initialData);
  const [visibleProjectIds, setVisibleProjectIds] = useState(initialData.visibleProjectIds);
  // The calendar always opens on the current month with today selected, on both
  // the desktop grid and the mobile agenda (they render from the same state).
  const [today, setToday] = useState(initialData.today);
  const [currentMonth, setCurrentMonth] = useState(startOfMonthDateString(initialData.today));
  const [selectedDate, setSelectedDate] = useState(initialData.today);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [rescheduleDraft, setRescheduleDraft] = useState<RescheduleDraft | null>(null);
  const [dragItem, setDragItem] = useState<CalendarDisplayItem | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [deadlineMoveConfirmation, setDeadlineMoveConfirmation] = useState<DeadlineMoveConfirmation | null>(null);
  const [isSavingMove, setIsSavingMove] = useState(false);
  const [exportProjectId, setExportProjectId] = useState(initialData.visibleProjectIds[0] ?? initialData.projects[0]?.projectId ?? null);
  const [expandedProjectHistory, setExpandedProjectHistory] = useState(false);
  const [exportStepsExpanded, setExportStepsExpanded] = useState(false);
  const [workSessionDraft, setWorkSessionDraft] = useState(() =>
    buildInitialWorkSessionDraft(initialData, initialData.today),
  );
  const [workSessionError, setWorkSessionError] = useState<string | null>(null);
  const [isSavingWorkSession, setIsSavingWorkSession] = useState(false);
  const [deletingWorkSessionId, setDeletingWorkSessionId] = useState<string | null>(null);
  const deferredVisibleProjectIds = useDeferredValue(visibleProjectIds);

  // Server-rendered `today` is UTC. Once mounted we know the real time zone, so
  // realign the highlighted day and the opening month — but never yank the view
  // out from under someone who has already navigated.
  useEffect(() => {
    const browserToday = getBrowserToday();
    if (!browserToday || browserToday === today) {
      return;
    }

    setToday(browserToday);
    if (!hasNavigated) {
      setCurrentMonth(startOfMonthDateString(browserToday));
      setSelectedDate(browserToday);
    }
  }, [hasNavigated, today]);

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
  const currentMonthItems = visibleItems.filter(
    (item) =>
      compareDateStrings(item.date, startOfMonthDateString(currentMonth)) >= 0 &&
      compareDateStrings(item.date, endOfMonthDateString(currentMonth)) <= 0,
  );
  // Overdue and due-soon are measured against today, not against whichever month
  // is on screen — an item that slipped in June is still overdue while you look
  // at July, and hiding it there is exactly the dishonest reading to avoid.
  const overdueCount = visibleItems.filter((item) => item.urgency === "overdue").length;
  const dueSoonCount = visibleItems.filter((item) => item.urgency === "due_soon").length;
  const monthItemCount = currentMonthItems.length;
  // Opening on today can land on a quiet month. Rather than a dead end, offer a
  // jump to the nearest dated work so the month view stays useful.
  const nearestItem =
    monthItemCount === 0
      ? visibleItems.find((item) => compareDateStrings(item.date, today) >= 0)
        ?? visibleItems[visibleItems.length - 1]
        ?? null
      : null;
  const unscheduledProjects = visibleProjects.filter((project) => !project.scheduleReady);
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
      setMoveError(toUserFacingError(body?.error ?? body?.message, "We couldn't update the calendar. Try again in a moment."));
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
      setWorkSessionError(toUserFacingError(body?.error, "We couldn't save that work block. Try again in a moment."));
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
      setWorkSessionError(toUserFacingError(body?.error, "We couldn't remove that work block. Try again in a moment."));
      setDeletingWorkSessionId(null);
      return;
    }

    applyProjectMutation(body.project, body.items);
    setDeletingWorkSessionId(null);
  }

  function moveMonth(offsetDays: number) {
    const nextMonth = startOfMonthDateString(addDaysToDateString(currentMonth, offsetDays));
    setHasNavigated(true);
    setCurrentMonth(nextMonth);
    if (!selectedDate.startsWith(nextMonth.slice(0, 7))) {
      setSelectedDate(nextMonth);
    }
  }

  function goToToday() {
    setHasNavigated(false);
    setCurrentMonth(startOfMonthDateString(today));
    setSelectedDate(today);
  }

  const moveOnlyConfirmationActive = rescheduleDraft
    ? deadlineMoveConfirmation?.key === getMoveConfirmationKey(rescheduleDraft.item, rescheduleDraft.targetDate, "move_only")
    : false;
  const rebalanceConfirmationActive = rescheduleDraft
    ? deadlineMoveConfirmation?.key === getMoveConfirmationKey(rescheduleDraft.item, rescheduleDraft.targetDate, "rebalance_downstream")
    : false;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Project calendar"
        title="Turn your roadmap into a workable month."
        description="Keep steps, completion targets, and focused work blocks in one calm planning view. Moving a date here updates it everywhere without changing the estimate behind the step."
        metadata={
          <>
            <Badge tone="neutral">{getPlanLabel(plan)}</Badge>
            <span>{visibleProjects.length} projects visible</span>
            <span aria-hidden="true">·</span>
            <span>{monthItemCount} items this month</span>
          </>
        }
      />

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
            <Button href="/dashboard">
              Open dashboard
            </Button>
            <Button href="/recommendations" variant="outline">
              Browse ideas
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            <section
              aria-labelledby="calendar-month-heading"
              className="overflow-hidden rounded-xl border border-line bg-paper shadow-soft"
            >
              <div className="border-b border-line px-4 py-4 sm:px-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-ink-muted">Month view</p>
                    <h2 id="calendar-month-heading" className="text-xl font-semibold tracking-tight text-ink">
                      {formatMonthLabel(currentMonth)}
                    </h2>
                  </div>
                  <div
                    className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface/55 p-1"
                    role="group"
                    aria-label="Calendar month navigation"
                  >
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveMonth(-1)}>
                      Previous
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={goToToday}>
                      Today
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => moveMonth(32)}>
                      Next
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-line bg-canvas/70 px-3 py-2 text-xs text-ink-muted">
                  <span>
                    <strong className="font-semibold text-ink">{monthItemCount}</strong> items this month
                  </span>
                  <span>
                    <strong className="font-semibold text-ink">{visibleProjects.length}</strong> visible projects
                  </span>
                  <span className={cn("font-medium", dueSoonCount > 0 ? "text-ink-soft" : "text-ink-muted")}>
                    {dueSoonCount} due soon
                  </span>
                  <span className={cn("font-medium", overdueCount > 0 ? "text-red-700" : "text-emerald-700")}>
                    {overdueCount > 0 ? `${overdueCount} overdue` : "Nothing overdue"}
                  </span>
                  <span className="basis-full text-[11px] text-ink-muted sm:basis-auto">
                    Due soon and overdue are counted across every visible project, not just this month.
                  </span>
                </div>

                {nearestItem ? (
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-muted">
                    <span>
                      Nothing is scheduled in {formatMonthLabel(currentMonth)}. The nearest dated work is{" "}
                      {formatDateForDisplay(nearestItem.date, { month: "long", day: "numeric", year: "numeric" })}.
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setHasNavigated(true);
                        setCurrentMonth(startOfMonthDateString(nearestItem.date));
                        setSelectedDate(nearestItem.date);
                      }}
                    >
                      Jump to it
                    </Button>
                  </div>
                ) : null}
              </div>

              <div className="hidden grid-cols-7 border-b border-line bg-surface/55 sm:grid" aria-hidden="true">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
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
                    today={today}
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
            </section>

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
                          <p className="text-xs text-ink-muted">{project.projectKindLabel} roadmap is ready, but dates are missing.</p>
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
                  <h2 className="text-2xl font-semibold text-ink">Keep up to four projects in view.</h2>
                </div>
                <p className="max-w-xl text-sm leading-6 text-ink-soft">
                  Swap which timelines stay visible without turning the page into a cluttered project management wall.
                </p>
              </div>

              <div className="min-w-0">
                <ProjectSelector
                  projects={data.projects}
                  visibleProjectIds={visibleProjectIds}
                  expandedHistory={expandedProjectHistory}
                  onToggleExpanded={() => setExpandedProjectHistory((previous) => !previous)}
                  onToggle={(project) => setVisibleProjectIds((current) => toggleProjectId(data.projects, current, project))}
                />
              </div>
            </Card>
          </div>

          <aside aria-label="Calendar details and planning" className="space-y-4 xl:sticky xl:top-24 xl:self-start">
            <Card padding="sm" className="space-y-5">
              <div className="space-y-2">
                <p className="editorial-kicker">Plan work time</p>
                <h2 className="text-lg font-semibold tracking-tight text-ink">Add a focused work block.</h2>
                <p className="text-sm leading-5 text-ink-soft">Turn the selected day into a concrete commitment.</p>
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

                <Button type="submit" fullWidth disabled={isSavingWorkSession || !workSessionProject}>
                  {isSavingWorkSession ? "Saving..." : "Plan work block"}
                </Button>
              </form>
            </Card>

            <Card padding="sm" className="space-y-4 border-primary/20 bg-primary-soft">
              <div className="space-y-2">
                <p className="editorial-kicker">Selected day</p>
                <h2 className="text-lg font-semibold leading-snug tracking-tight text-ink">
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
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-lg border px-3 py-3",
                        getStatusSurfaceClassName(item.status),
                        item.itemType === "work_session" && item.completedAt && "opacity-65",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral"><span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${getProjectColor(item.projectId).dot}`} />{item.projectKindLabel}</Badge>
                        <Badge tone={getUrgencyTone(item.urgency)}>{getUrgencyLabel(item.urgency)}</Badge>
                        {item.isUserScheduledOverride ? <Badge tone="neutral">Manual move</Badge> : null}
                        {item.itemType === "work_session" && item.completedAt ? (
                          <Badge tone="neutral">✓ Completed</Badge>
                        ) : null}
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
                        {item.itemType === "work_session" && !item.completedAt ? (
                          <Button
                            href={`/project/${item.projectId}/focus?session=${encodeURIComponent(item.id)}`}
                            size="sm"
                            className="rounded-lg"
                          >
                            Start
                          </Button>
                        ) : null}
                        <Button href={item.href} variant="outline" size="sm">
                          Open in workspace
                        </Button>
                        {item.itemType === "work_session" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="rounded-lg"
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
                            className="rounded-lg"
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

            <Card padding="sm" className="space-y-4">
              <div className="space-y-2">
                <p className="editorial-kicker">Legend</p>
                <h2 className="text-base font-semibold text-ink">Completion is the main signal.</h2>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
                  <span className="h-3 w-3 rounded-full border border-line-strong bg-paper" />
                  <span className="text-sm text-ink-soft">Not started</span>
                </div>
                <div className="flex items-center gap-3 rounded-md bg-navy/[0.05] px-2 py-1.5">
                  <span className="h-3 w-3 rounded-full border border-navy/30 bg-navy" />
                  <span className="text-sm text-ink">In progress</span>
                </div>
                <div className="flex items-center gap-3 rounded-md bg-teal/10 px-2 py-1.5">
                  <span className="h-3 w-3 rounded-full border border-teal-deep/30 bg-teal-deep" />
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

            <Card padding="sm" className="space-y-5">
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
                              : "border-line bg-canvas/70 text-ink-soft hover:border-line-strong hover:bg-paper",
                          )}
                          onClick={() => setExportProjectId(project.projectId)}
                        >
                          {project.projectTitle}
                        </button>
                      ))}
                    </div>

                    {exportProject.scheduleReady ? (
                      <>
                        <div className="rounded-[1.4rem] border border-line bg-canvas/70 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-ink">{exportProject.projectTitle}</p>
                              <p className="text-xs text-ink-muted">{buildCalendarExportEvents(exportProject.items).length} all-day events ready to export.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExportStepsExpanded((prev) => !prev)}
                                className="rounded-full border border-line bg-canvas/70 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-line-strong hover:bg-paper hover:text-ink"
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
                                className="block rounded-2xl border border-line bg-paper px-4 py-3 transition hover:border-line-strong hover:bg-canvas/70"
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
                      <div className="space-y-3 rounded-[1.4rem] border border-line bg-canvas/70 p-4">
                        <p className="text-sm text-ink-soft">Dates need to be rebuilt before this project can be exported.</p>
                        <CalendarScheduleRetryButton projectId={exportProject.projectId} className="rounded-full" />
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-ink-soft">Choose a visible project to export.</p>
                )
              ) : (
                <div className="space-y-4 rounded-[1.4rem] border border-line bg-canvas/70 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="warning">Pro only</Badge>
                    <Badge tone="neutral">{getPlanLabel(plan)}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-ink-soft">
                    Calendar exports stay behind Pro. Free users can still plan and reschedule everything inside Sevri.
                  </p>
                  <Button href="/settings/billing" variant="outline">
                    Upgrade to Pro
                  </Button>
                </div>
              )}
            </Card>
          </aside>
        </div>
      )}

      {rescheduleDraft ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/25 px-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl space-y-5 shadow-lifted">
            <div className="space-y-2">
              <p className="editorial-kicker">Move date</p>
              <h2 className="text-2xl font-semibold text-ink">{rescheduleDraft.item.title}</h2>
              <p className="text-sm leading-6 text-ink-soft">
                The AI time estimate stays intact. This only changes the scheduled date that Sevri uses across the app.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-canvas/70 p-4">
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

            <div className="space-y-3 rounded-2xl border border-line bg-canvas/70 p-4">
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
