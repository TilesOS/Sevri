import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { buildCalendarExportEvents, buildIcsFile } from "@/lib/calendar/export";
import { buildProjectCalendarItems } from "@/lib/calendar/items";
import { getProjectScheduleGenerationContext } from "@/lib/db/queries/calendar";
import { captureServerError } from "@/lib/sentry/server";
import { assertFeatureAccess, createUpgradeRequiredResponse } from "@/lib/usage/feature-access";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const { id: projectId } = await context.params;
  const access = await assertFeatureAccess({ userId: user.id, feature: "calendar_export" });
  if (!access.allowed) {
    return createUpgradeRequiredResponse(access.error);
  }

  try {
    const project = await getProjectScheduleGenerationContext(projectId, user.id);
    const items = buildProjectCalendarItems({ project });
    const file = buildIcsFile({
      events: buildCalendarExportEvents(items),
    });

    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${slugify(project.projectTitle)}-schedule.ics"`,
      },
    });
  } catch (error) {
    captureServerError(error, {
      route: "projects/calendar/export/ics",
      project_id: projectId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build calendar export." },
      { status: 400 },
    );
  }
}
