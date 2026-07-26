import { z } from "zod";
import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { claimFirstTimePortfolioCurations } from "@/lib/db/mutations/portfolio";
import { runClaimedFirstTimePortfolioCurations } from "@/lib/portfolio/curation";
import { captureServerError } from "@/lib/sentry/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  project_id: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  try {
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const claims = await claimFirstTimePortfolioCurations({
      projectId: body.project_id,
      limit: body.project_id ? 1 : 3,
    });
    const result = await runClaimedFirstTimePortfolioCurations({
      userId: user.id,
      claims,
    });

    return NextResponse.json({
      status: claims.length > 0 ? "completed" : "pending",
      attempted: result.attempted,
      completed: result.completed,
    });
  } catch (error) {
    captureServerError(error, { route: "portfolio/curation" });
    return NextResponse.json(
      { error: "We couldn't finish preparing the Portfolio summary. Try again in a moment." },
      { status: error instanceof z.ZodError ? 400 : 500 },
    );
  }
}
