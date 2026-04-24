import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { generateAndSavePortfolioCuration } from "@/lib/portfolio/curation";
import { getPortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";
import { enforceRateLimit } from "@/lib/usage/rate-limit";
import { assertFeatureAccess, createUpgradeRequiredResponse } from "@/lib/usage/feature-access";

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

  const access = await assertFeatureAccess({
    userId: user.id,
    feature: "portfolio_regenerate_curation",
  });
  if (!access.allowed) {
    return createUpgradeRequiredResponse(access.error);
  }

  const limit = await enforceRateLimit({
    userId: user.id,
    endpoint: `portfolio_curation_regen:${view.entry.id}`,
    maxRequests: 5,
    windowMinutes: 24 * 60,
  });
  if (!limit.allowed) {
    return NextResponse.json({ code: "rate_limited", resetAt: limit.resetAt }, { status: 429 });
  }

  const result = await generateAndSavePortfolioCuration({
    projectId,
    userId: user.id,
    source: "regenerate",
  });

  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (result.blocked) {
    return NextResponse.json(
      { code: "safety_check_failed", findings: result.findings },
      { status: 422 },
    );
  }

  return NextResponse.json({ entry: result.entry });
}
