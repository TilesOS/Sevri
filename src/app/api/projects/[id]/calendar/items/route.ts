import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiStudent } from "@/lib/auth/api";
import { isDateString, normalizeTimeZone } from "@/lib/calendar/date-utils";
import { buildProjectCalendarItems } from "@/lib/calendar/items";
import { applyMoveOnly, applyRebalanceDownstream } from "@/lib/calendar/schedule";
import { persistProjectSchedulePatch } from "@/lib/db/mutations/calendar";
import { getProjectScheduleGenerationContext } from "@/lib/db/queries/calendar";
import { captureServerError } from "@/lib/sentry/server";

const bodySchema = z.object({
  itemType: z.enum(["project_start", "milestone", "project_end"]),
  milestoneId: z.string().uuid().optional(),
  targetDate: z.string(),
  mode: z.enum(["move_only", "rebalance_downstream"]),
  timezone: z.string().min(1).max(120).optional(),
});

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

    await persistProjectSchedulePatch({
      projectId,
      scheduledStartDate: nextState.scheduledStartDate ?? project.scheduledStartDate,
      scheduledEndDate: nextState.scheduledEndDate ?? project.scheduledEndDate,
      scheduleTimezone,
      source: body.mode === "move_only" ? "move_only" : "rebalance_downstream",
      lastScheduleRebalancedAt: body.mode === "rebalance_downstream" ? new Date().toISOString() : project.lastScheduleRebalancedAt,
      milestoneUpdates: nextState.milestones,
    });

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
