import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics/track";
import { requireApiStudent } from "@/lib/auth/api";
import { getPortfolioView } from "@/lib/portfolio/portfolio-view";

export async function GET() {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  const portfolio = await getPortfolioView(user.id);

  try {
    await trackEvent(user.id, "portfolio_viewed", {
      source: "api",
      entry_count: portfolio.entries.length,
      completed_count: portfolio.counts.completed,
    });
  } catch (error) {
    console.error("portfolio_viewed API tracking failed", error);
  }

  return NextResponse.json(portfolio);
}
