import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { selectProjectFromRecommendation } from "@/lib/db/mutations/projects";
import { trackEvent } from "@/lib/analytics/track";
import { captureServerError } from "@/lib/sentry/server";

const bodySchema = z.object({
  recommendation_id: z.string().uuid(),
  operation_id: z.string().uuid(),
  /**
   * Set only after the student confirms a second copy in the UI. Without it, a
   * repeat selection is answered with the project that already exists, so a
   * double-click (or a retried request) can never create two.
   */
  allow_duplicate: z.boolean().optional(),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const body = bodySchema.parse(await request.json());

    const project = await selectProjectFromRecommendation(
      body.recommendation_id,
      body.operation_id,
      Boolean(body.allow_duplicate),
    );

    if (project.outcome === "duplicate") {
      return NextResponse.json(
        {
          code: "duplicate_project",
          project_id: project.id,
          project_title: project.title,
          project_track: project.project_track,
          error: "You already started this idea.",
        },
        { status: 409 },
      );
    }

    if (project.outcome === "created") {
      await trackEvent(user.id, "recommendation_selected", {
        recommendation_id: body.recommendation_id,
        project_id: project.id,
        project_track: project.project_track,
        duplicate_confirmed: Boolean(body.allow_duplicate),
      });
    }

    return NextResponse.json({ project_id: project.id, project_track: project.project_track }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "recommendations/select" });
    return NextResponse.json(
      { error: "We couldn't start that project. Try again in a moment." },
      { status: 400 },
    );
  }
}
