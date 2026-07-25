import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { setProjectArchived } from "@/lib/db/mutations/projects";
import { trackEvent } from "@/lib/analytics/track";
import { captureServerError } from "@/lib/sentry/server";

const bodySchema = z.object({
  archived: z.boolean(),
});

/**
 * Archive or restore a project. Nothing is deleted: an archived project keeps
 * its roadmap, steps, submissions, and Portfolio entry, and simply stops
 * appearing on the dashboard and calendar.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json());

    const project = await setProjectArchived(user.id, id, body.archived);

    await trackEvent(user.id, body.archived ? "project_archived" : "project_restored", {
      project_id: id,
    }).catch(() => undefined);

    return NextResponse.json({ project_id: project.id, status: project.status }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "projects/archive" });
    return NextResponse.json(
      { error: "We couldn't update that project. Try again in a moment." },
      { status: 400 },
    );
  }
}
