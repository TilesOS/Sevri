import { notFound } from "next/navigation";
import { PortfolioDetailClient } from "@/components/portfolio/portfolio-detail-client";
import { trackEvent } from "@/lib/analytics/track";
import { getRequiredStudentUser } from "@/lib/auth/guard";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getPortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";

async function trackPortfolioProjectOpened(input: {
  userId: string;
  projectId: string;
  portfolioEntryId: string;
}) {
  try {
    await trackEvent(input.userId, "portfolio_project_opened", {
      project_id: input.projectId,
      portfolio_entry_id: input.portfolioEntryId,
    });
  } catch (error) {
    console.error("portfolio_project_opened tracking failed", error);
  }
}

export default async function PortfolioProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getRequiredStudentUser();
  const { projectId } = await params;

  const [view, plan] = await Promise.all([
    getPortfolioEntryDetailView(projectId, user.id),
    getUserPlan(user.id),
  ]);

  if (!view) {
    notFound();
  }

  await trackPortfolioProjectOpened({
    userId: user.id,
    projectId,
    portfolioEntryId: view.entry.id,
  });

  return <PortfolioDetailClient view={view} plan={plan} />;
}
