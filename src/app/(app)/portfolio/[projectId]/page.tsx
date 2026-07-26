import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioDetailClient } from "@/components/portfolio/portfolio-detail-client";
import { PortfolioEntryPendingClient } from "@/components/portfolio/portfolio-entry-pending-client";
import { getAuthenticatedUser, getRequiredStudentUser } from "@/lib/auth/guard";
import { WORKSPACE_LABELS } from "@/lib/copy/glossary";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { getPortfolioProjectForUser } from "@/lib/db/queries/portfolio";
import { getPortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const fallback: Metadata = { title: WORKSPACE_LABELS.portfolio };

  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return fallback;
    }

    const project = await getPortfolioProjectForUser(projectId, user.id);
    const title = project?.title?.trim();

    return title ? { title: `${title} · ${WORKSPACE_LABELS.portfolio}` } : fallback;
  } catch {
    return fallback;
  }
}

export default async function PortfolioProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const user = await getRequiredStudentUser();
  const { projectId } = await params;

  const [view, plan, project] = await Promise.all([
    getPortfolioEntryDetailView(projectId, user.id),
    getUserPlan(user.id),
    getPortfolioProjectForUser(projectId, user.id),
  ]);

  if (!view) {
    if (!project) {
      notFound();
    }
    return (
      <PortfolioEntryPendingClient
        projectId={projectId}
        projectTitle={project.title}
      />
    );
  }

  return <PortfolioDetailClient view={view} plan={plan} />;
}
