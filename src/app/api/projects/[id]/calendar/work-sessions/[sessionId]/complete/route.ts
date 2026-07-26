import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { buildProjectCalendarItems } from "@/lib/calendar/items";
import { getProjectScheduleGenerationContext } from "@/lib/db/queries/calendar";
import { syncProjectToGoogleCalendar } from "@/lib/integrations/google-calendar/sync";
import { captureServerError } from "@/lib/sentry/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; sessionId: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const { id: projectId, sessionId } = await context.params;

  try {
    await getProjectScheduleGenerationContext(projectId, user.id, {
      visibility: "workspace",
    });

    const supabase = await createServerSupabaseClient();
    const { data: session, error: sessionError } = await supabase
      .from("project_work_sessions")
      .select("id, completed_at")
      .eq("id", sessionId)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError) {
      throw new Error(`Failed to load planned work session: ${sessionError.message}`);
    }

    if (!session) {
      return NextResponse.json({ error: "Planned work session not found." }, { status: 404 });
    }

    if (session.completed_at) {
      return NextResponse.json({ error: "This work session is already complete." }, { status: 409 });
    }

    const { data: completedSession, error: updateError } = await supabase
      .from("project_work_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("project_id", projectId)
      .eq("user_id", user.id)
      .is("completed_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to complete planned work session: ${updateError.message}`);
    }

    if (!completedSession) {
      return NextResponse.json({ error: "This work session is already complete." }, { status: 409 });
    }

    const refreshed = await getProjectScheduleGenerationContext(projectId, user.id, {
      visibility: "workspace",
    });
    await syncProjectToGoogleCalendar({
      userId: user.id,
      project: refreshed,
    }).catch((syncError) => {
      captureServerError(syncError, {
        route: "projects/calendar/work-sessions:complete",
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
      route: "projects/calendar/work-sessions:complete",
      project_id: projectId,
      session_id: sessionId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete planned work time." },
      { status: 400 },
    );
  }
}
