import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { deleteGoogleCalendarSyncData } from "@/lib/db/mutations/google-calendar";
import { deleteUserIntegration } from "@/lib/db/mutations/github";
import { getCalendarPageData } from "@/lib/db/queries/calendar";
import { getGoogleCalendarSyncSettingsAdmin } from "@/lib/db/queries/google-calendar";
import {
  getGoogleCalendarClientForUser,
  syncProjectToGoogleCalendar,
} from "@/lib/integrations/google-calendar/sync";
import { captureServerError } from "@/lib/sentry/server";

export async function POST() {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  try {
    const calendarData = await getCalendarPageData(user.id);
    let syncedProjects = 0;
    for (const project of calendarData.projects) {
      const result = await syncProjectToGoogleCalendar({
        userId: user.id,
        project,
      });
      if (!result.skipped) {
        syncedProjects += 1;
      }
    }

    return NextResponse.json({ status: "synced", synced_projects: syncedProjects }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "integrations/google-calendar/resync" });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync Google Calendar." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  try {
    const settings = await getGoogleCalendarSyncSettingsAdmin(user.id);
    if (settings?.calendar_id) {
      const client = await getGoogleCalendarClientForUser(user.id);
      await client?.deleteCalendar(settings.calendar_id).catch((error) => {
        captureServerError(error, {
          route: "integrations/google-calendar/disconnect",
          step: "delete-google-calendar",
        });
      });
    }

    await deleteGoogleCalendarSyncData(user.id);
    await deleteUserIntegration(user.id, "google_calendar");
    return NextResponse.json({ status: "disconnected" }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "integrations/google-calendar/disconnect" });
    return NextResponse.json(
      { error: "Failed to disconnect Google Calendar" },
      { status: 500 },
    );
  }
}

