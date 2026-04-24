import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics/track";
import { requireApiStudent } from "@/lib/auth/api";
import { unpublishPortfolioPage } from "@/lib/db/mutations/portfolio";
import { getPortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";
import { captureServerError } from "@/lib/sentry/server";

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

  try {
    const publicPage = await unpublishPortfolioPage({
      entryId: view.entry.id,
      userId: user.id,
    });

    await trackEvent(user.id, "portfolio_unpublished", {
      project_id: projectId,
      portfolio_entry_id: view.entry.id,
      slug: publicPage?.slug ?? view.publicPage?.slug ?? null,
    });

    return NextResponse.json({ public_page: publicPage });
  } catch (error) {
    captureServerError(error, {
      route: "portfolio/unpublish",
      project_id: projectId,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to unpublish Portfolio page." },
      { status: 400 },
    );
  }
}
