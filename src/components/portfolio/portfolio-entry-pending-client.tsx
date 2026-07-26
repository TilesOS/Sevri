"use client";

import { PortfolioCurationTrigger } from "@/components/portfolio/portfolio-curation-trigger";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export function PortfolioEntryPendingClient({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle: string;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <PageHeader
          eyebrow="Private Portfolio"
          title={projectTitle}
          description="This entry is being prepared. Your project work is already saved."
          className="border-b-0 pb-0"
        />
      </Card>
      <PortfolioCurationTrigger
        active
        curationKey={`initialize:${projectId}`}
        projectId={projectId}
      />
    </div>
  );
}
