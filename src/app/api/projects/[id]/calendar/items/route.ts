import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiStudent } from "@/lib/auth/api";
import { compareDateStrings, isDateString, normalizeTimeZone } from "@/lib/calendar/date-utils";
import {
  getDeadlineExtensionDecision,
  type DeadlineExtensionEventInput,
  type DeadlineExtensionItemType,
} from "@/lib/calendar/deadline-extension";
import { buildProjectCalendarItems } from "@/lib/calendar/items";
import { applyMoveOnly, applyRebalanceDownstream } from "@/lib/calendar/schedule";
import { persistProjectSchedulePatch } from "@/lib/db/mutations/calendar";
import { getProjectScheduleGenerationContext } from "@/lib/db/queries/calendar";
import { captureServerError } from "@/lib/sentry/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProjectScheduleState } from "@/lib/calendar/types";

const bodySchema = z.object({
  itemType: z.enum(["project_start", "milestone", "project_end"]),
  milestoneId: z.string().uuid().optional(),
  targetDate: z.string(),
  mode: z.enum(["move_only", "rebalance_downstream"]),
  timezone: z.string().min(1).max(120).optional(),
  deadlineExtensionConfirmed: z.boolean().optional(),
});

function getCurrentDeadline(input: {
  project: ProjectScheduleState;
  itemType: "milestone" | "project_end";
  milestoneId?: string | null;
}) {
  if (input.itemType === "project_end") {
    return input.project.scheduledEndDate;
  }

  if (!input.milestoneId) {
    throw new Error("milestoneId is required when moving a step due date.");
  }

  return input.project.milestones.find((milestone) => milestone.id === input.milestoneId)?.dueDate ?? null;
}

async function getDeadlineExtensionHistory(input: {
  userId: string;
  projectId: string;
  itemType: DeadlineExtensionItemType;
  milestoneId: string | null;
}) {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("deadline_extension_events")
    .select("created_at", { count: "exact" })
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId)
    .eq("item_type", input.itemType);

  query = input.milestoneId ? query.eq("milestone_id", input.milestoneId) : query.is("milestone_id", null);

  const { data, error, count } = await query.order("created_at", { ascending: false }).limit(1);

  if (error) {
    throw new Error(`Failed to inspect deadline extension history: ${error.message}`);
  }

  return {
    extensionCount: count ?? 0,
    latestExtensionCreatedAt: data?.[0]?.created_at ?? null,
  };
}

async function recordDeadlineExtensionEvent(input: DeadlineExtensionEventInput) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("deadline_extension_events").insert({
    user_id: input.userId,
    project_id: input.projectId,
    milestone_id: input.milestoneId,
    item_type: input.itemType,
    previous_date: input.previousDate,
    requested_date: input.requestedDate,
    move_mode: input.moveMode,
    extension_number: input.extensionNumber,
  });

  if (error) {
    throw new Error(`Failed to record deadline extension: ${error.message}`);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const { id: projectId } = await context.params;

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    if (!isDateString(body.targetDate)) {
      return NextResponse.json({ error: "Invalid target date." }, { status: 400 });
    }

    if (body.itemType === "project_end" && body.mode === "rebalance_downstream") {
      return NextResponse.json(
        { error: "Project completion can only be moved directly." },
        { status: 400 },
      );
    }

    const project = await getProjectScheduleGenerationContext(projectId, user.id);
    const scheduleReady =
      project.scheduledStartDate &&
      project.scheduledEndDate &&
      project.milestones.every((milestone) => milestone.dueDate && milestone.scheduleDurationDays);

    if (!scheduleReady) {
      return NextResponse.json({ error: "Generate the schedule first." }, { status: 400 });
    }

    const scheduleTimezone = normalizeTimeZone(body.timezone ?? project.scheduleTimezone);
    const projectWithTimezone = {
      ...project,
      scheduleTimezone,
    };
    const nextState =
      body.mode === "move_only"
        ? applyMoveOnly({
            project: projectWithTimezone,
            itemType: body.itemType,
            milestoneId: body.milestoneId,
            targetDate: body.targetDate,
          })
        : applyRebalanceDownstream({
            project: projectWithTimezone,
            itemType: body.itemType === "project_start" ? "project_start" : "milestone",
            milestoneId: body.milestoneId,
            targetDate: body.targetDate,
          });
    const deadlineItemType =
      body.itemType === "milestone" || body.itemType === "project_end" ? body.itemType : null;
    let deadlineExtensionEvent: DeadlineExtensionEventInput | null = null;

    if (deadlineItemType) {
      const currentDeadline = getCurrentDeadline({
        project: projectWithTimezone,
        itemType: deadlineItemType,
        milestoneId: body.milestoneId ?? null,
      });

      if (!currentDeadline) {
        return NextResponse.json({ error: "Scheduled due date not found." }, { status: 400 });
      }

      if (compareDateStrings(body.targetDate, currentDeadline) > 0) {
        const history = await getDeadlineExtensionHistory({
          userId: user.id,
          projectId,
          itemType: deadlineItemType,
          milestoneId: deadlineItemType === "milestone" ? body.milestoneId ?? null : null,
        });
        const decision = getDeadlineExtensionDecision({
          currentDate: currentDeadline,
          targetDate: body.targetDate,
          history,
          confirmed: body.deadlineExtensionConfirmed === true,
          timeZone: scheduleTimezone,
        });

        if (decision.status === "confirmation_required") {
          return NextResponse.json(
            {
              code: "deadline_extension_confirmation_required",
              extension_number: decision.extensionNumber,
              message: decision.message,
            },
            { status: 409 },
          );
        }

        if (decision.status === "cooldown_active") {
          return NextResponse.json(
            {
              code: "deadline_extension_cooldown_active",
              extension_number: decision.extensionNumber,
              cooldown_ends_at: decision.cooldownEndsAt,
              message: decision.message,
            },
            { status: 429 },
          );
        }

        if (decision.status === "allowed") {
          deadlineExtensionEvent = {
            userId: user.id,
            projectId,
            itemType: deadlineItemType,
            milestoneId: deadlineItemType === "milestone" ? body.milestoneId ?? null : null,
            previousDate: currentDeadline,
            requestedDate: body.targetDate,
            moveMode: body.mode,
            extensionNumber: decision.extensionNumber,
          };
        }
      }
    }

    await persistProjectSchedulePatch({
      projectId,
      scheduledStartDate: nextState.scheduledStartDate ?? project.scheduledStartDate,
      scheduledEndDate: nextState.scheduledEndDate ?? project.scheduledEndDate,
      scheduleTimezone,
      source: body.mode === "move_only" ? "move_only" : "rebalance_downstream",
      lastScheduleRebalancedAt: body.mode === "rebalance_downstream" ? new Date().toISOString() : project.lastScheduleRebalancedAt,
      milestoneUpdates: nextState.milestones,
    });

    if (deadlineExtensionEvent) {
      await recordDeadlineExtensionEvent(deadlineExtensionEvent);
    }

    const refreshed = await getProjectScheduleGenerationContext(projectId, user.id);
    return NextResponse.json(
      {
        project: refreshed,
        items: buildProjectCalendarItems({
          project: refreshed,
        }),
      },
      { status: 200 },
    );
  } catch (error) {
    captureServerError(error, {
      route: "projects/calendar/items",
      project_id: projectId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update the schedule." },
      { status: 400 },
    );
  }
}
