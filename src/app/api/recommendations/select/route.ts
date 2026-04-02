import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createProjectFromRecommendation } from "@/lib/db/mutations/projects";
import { trackEvent } from "@/lib/analytics/track";
import { captureServerError } from "@/lib/sentry/server";

const bodySchema = z.object({
  recommendation_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const body = bodySchema.parse(await request.json());
    const project = await createProjectFromRecommendation(user.id, body.recommendation_id);

    await trackEvent(user.id, "recommendation_selected", {
      recommendation_id: body.recommendation_id,
      project_id: project.id,
      project_track: project.project_track,
    });

    return NextResponse.json({ project_id: project.id, project_track: project.project_track }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "recommendations/select" });
    return NextResponse.json({ error: "Failed to select recommendation" }, { status: 400 });
  }
}
