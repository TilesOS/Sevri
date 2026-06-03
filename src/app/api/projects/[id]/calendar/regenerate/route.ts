import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiStudent } from "@/lib/auth/api";
import { normalizeTimeZone } from "@/lib/calendar/date-utils";
import { buildProjectCalendarItems } from "@/lib/calendar/items";
import { generateProjectSchedule } from "@/lib/calendar/schedule";
import { clearProjectSchedule, persistProjectSchedule } from "@/lib/db/mutations/calendar";
import { getProjectScheduleGenerationContext } from "@/lib/db/queries/calendar";
import { syncProjectToGoogleCalendar } from "@/lib/integrations/google-calendar/sync";
import { captureServerError } from "@/lib/sentry/server";

const bodySchema = z.object({
  timezone: z.string().min(1).max(120).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const { id: projectId } = await context.params;

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const project = await getProjectScheduleGenerationContext(projectId, user.id);
    if (project.milestones.length === 0) {
      return NextResponse.json({ error: "Generate the roadmap first." }, { status: 400 });
    }

    const scheduleTimezone = normalizeTimeZone(body.timezone ?? project.scheduleTimezone);
    const schedule = generateProjectSchedule({
      milestones: project.milestones,
      estimatedWeeks: project.estimatedWeeks,
      weeklyHours: project.weeklyHours,
      projectTrack: project.projectTrack,
      timeZone: scheduleTimezone,
      startDate: project.scheduledStartDate ?? undefined,
    });

    await clearProjectSchedule({
      projectId,
      timeZone: scheduleTimezone,
    });
    await persistProjectSchedule({
      projectId,
      schedule,
      source: "manual_regenerate",
      lastScheduleRebalancedAt: new Date().toISOString(),
    });

    const refreshed = await getProjectScheduleGenerationContext(projectId, user.id);
    await syncProjectToGoogleCalendar({
      userId: user.id,
      project: refreshed,
    }).catch((syncError) => {
      captureServerError(syncError, {
        route: "projects/calendar/regenerate",
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
      { status: 200 },
    );
  } catch (error) {
    captureServerError(error, {
      route: "projects/calendar/regenerate",
      project_id: projectId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to regenerate schedule." },
      { status: 400 },
    );
  }
}
