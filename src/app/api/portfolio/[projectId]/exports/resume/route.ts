import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { generateAndSavePortfolioExport } from "@/lib/portfolio/exports";
import { getPortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";
import { captureServerError } from "@/lib/sentry/server";
import { assertFeatureAccess, createUpgradeRequiredResponse } from "@/lib/usage/feature-access";
import { enforceRateLimit } from "@/lib/usage/rate-limit";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const { user, response } = await requireApiStudent();
  if (!user) return response;

  const { projectId } = await context.params;
  const view = await getPortfolioEntryDetailView(projectId, user.id);
  if (!view) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await assertFeatureAccess({ userId: user.id, feature: "portfolio_export" });
  if (!access.allowed) {
    return createUpgradeRequiredResponse(access.error);
  }

  try {
    const limit = await enforceRateLimit({
      userId: user.id,
      endpoint: `portfolio_export:resume_bullets:${view.entry.id}`,
      maxRequests: 10,
      windowMinutes: 24 * 60,
    });
    if (!limit.allowed) {
      return NextResponse.json({ code: "rate_limited", resetAt: limit.resetAt }, { status: 429 });
    }

    const result = await generateAndSavePortfolioExport({
      projectId,
      userId: user.id,
      format: "resume_bullets",
    });
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ portfolio_export: result.export });
  } catch (error) {
    captureServerError(error, {
      route: "portfolio/exports/resume",
      project_id: projectId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate resume export." },
      { status: 400 },
    );
  }
}
