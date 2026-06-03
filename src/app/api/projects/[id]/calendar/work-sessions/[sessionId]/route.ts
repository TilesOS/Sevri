import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { buildProjectCalendarItems } from "@/lib/calendar/items";
import { getProjectScheduleGenerationContext } from "@/lib/db/queries/calendar";
import { syncProjectToGoogleCalendar } from "@/lib/integrations/google-calendar/sync";
import { captureServerError } from "@/lib/sentry/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; sessionId: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const { id: projectId, sessionId } = await context.params;

  try {
    await getProjectScheduleGenerationContext(projectId, user.id);

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("project_work_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("project_id", projectId)
      .eq("user_id", user.id);

    if (error) {
      throw new Error(`Failed to delete planned work session: ${error.message}`);
    }

    const refreshed = await getProjectScheduleGenerationContext(projectId, user.id);
    await syncProjectToGoogleCalendar({
      userId: user.id,
      project: refreshed,
    }).catch((syncError) => {
      captureServerError(syncError, {
        route: "projects/calendar/work-sessions:delete",
        step: "google-calendar-sync",
        project_id: projectId,
        session_id: sessionId,
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
      route: "projects/calendar/work-sessions:delete",
      project_id: projectId,
      session_id: sessionId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove planned work time." },
      { status: 400 },
    );
  }
}
