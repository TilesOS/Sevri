import type { Metadata } from "next";
import { PortfolioListingClient } from "@/components/portfolio/portfolio-listing-client";
import { getRequiredStudentUser } from "@/lib/auth/guard";
import { getPortfolioView } from "@/lib/portfolio/portfolio-view";

export const metadata: Metadata = {
  title: "Portfolio",
};

export default async function PortfolioPage() {
  const user = await getRequiredStudentUser();
  const portfolio = await getPortfolioView(user.id);

  return (
    <PortfolioListingClient
      entries={portfolio.entries}
      pendingCurationCount={portfolio.pendingCurationCount}
      completedCount={portfolio.counts.completed}
    />
  );
}
