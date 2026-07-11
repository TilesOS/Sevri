import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiStudent } from "@/lib/auth/api";
import { isDateString, normalizeTimeZone } from "@/lib/calendar/date-utils";
import { buildProjectCalendarItems } from "@/lib/calendar/items";
import { getProjectScheduleGenerationContext } from "@/lib/db/queries/calendar";
import { syncProjectToGoogleCalendar } from "@/lib/integrations/google-calendar/sync";
import { captureServerError } from "@/lib/sentry/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const TIME_PATTERN = /^\d{2}:\d{2}$/;

const bodySchema = z.object({
  milestoneId: z.string().uuid().nullable().optional(),
  date: z.string(),
  startTime: z.string(),
  triggerContext: z.string().max(160).optional(),
  workDescription: z.string().trim().min(3).max(240),
  location: z.string().trim().max(120).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  timezone: z.string().min(1).max(120).optional(),
  completedNow: z.boolean().optional(),
});

function isTimeString(value: string) {
  if (!TIME_PATTERN.test(value)) {
    return false;
  }

  const [hourPart, minutePart] = value.split(":");
  const hour = Number.parseInt(hourPart, 10);
  const minute = Number.parseInt(minutePart, 10);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const { id: projectId } = await context.params;

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    if (!isDateString(body.date)) {
      return NextResponse.json({ error: "Choose a valid work date." }, { status: 400 });
    }

    if (!isTimeString(body.startTime)) {
      return NextResponse.json({ error: "Choose a valid start time." }, { status: 400 });
    }

    const project = await getProjectScheduleGenerationContext(projectId, user.id);
    const milestoneId = body.milestoneId ?? null;
    if (milestoneId && !project.milestones.some((milestone) => milestone.id === milestoneId)) {
      return NextResponse.json({ error: "That step does not belong to this project." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("project_work_sessions").insert({
      user_id: user.id,
      project_id: projectId,
      milestone_id: milestoneId,
      local_date: body.date,
      local_time: body.startTime,
      schedule_timezone: normalizeTimeZone(body.timezone ?? project.scheduleTimezone),
      trigger_context: body.triggerContext?.trim() ?? "",
      work_description: body.workDescription,
      location: body.location?.trim() || null,
      duration_minutes: body.durationMinutes,
      completed_at: body.completedNow ? new Date().toISOString() : null,
    });

    if (error) {
      throw new Error(`Failed to create planned work session: ${error.message}`);
    }

    const refreshed = await getProjectScheduleGenerationContext(projectId, user.id);
    await syncProjectToGoogleCalendar({
      userId: user.id,
      project: refreshed,
    }).catch((syncError) => {
      captureServerError(syncError, {
        route: "projects/calendar/work-sessions:create",
        step: "google-calendar-sync",
        project_id: projectId,
      });
    });

    return NextResponse.json(
      {
        project: refreshed,
        items: buildProjectCalendarItems({
          project: refreshed,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    captureServerError(error, {
      route: "projects/calendar/work-sessions:create",
      project_id: projectId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to plan work time." },
      { status: 400 },
    );
  }
}
