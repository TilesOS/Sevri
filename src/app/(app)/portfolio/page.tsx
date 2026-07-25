import type { Metadata } from "next";
import { PortfolioListingClient } from "@/components/portfolio/portfolio-listing-client";
import { trackEvent } from "@/lib/analytics/track";
import { getRequiredStudentUser } from "@/lib/auth/guard";
import { getPortfolioView } from "@/lib/portfolio/portfolio-view";

export const metadata: Metadata = {
  title: "Portfolio",
};

async function trackPortfolioViewed(userId: string, entryCount: number, completedCount: number) {
  try {
    await trackEvent(userId, "portfolio_viewed", {
      entry_count: entryCount,
      completed_count: completedCount,
    });
  } catch (error) {
    console.error("portfolio_viewed tracking failed", error);
  }
}

export default async function PortfolioPage() {
  const user = await getRequiredStudentUser();
  const portfolio = await getPortfolioView(user.id);

  await trackPortfolioViewed(user.id, portfolio.entries.length, portfolio.counts.completed);

  return <PortfolioListingClient entries={portfolio.entries} />;
}
