import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { GenerateRoadmapButton } from "@/components/project/generate-roadmap-button";
import { PageHeader } from "@/components/ui/page-header";
import { getPlanLabel, trackThemes } from "@/components/theme/theme-utils";
import type { Plan } from "@/types/domain";
import type { ProjectTrack } from "@/types/domain";

export function ProjectRoadmapEmptyState({
  projectId,
  projectTitle,
  projectTrack,
  plan,
}: {
  projectId: string;
  projectTitle: string;
  projectTrack: ProjectTrack;
  plan: Plan;
}) {
  const trackTheme = trackThemes[projectTrack];

  return (
    <div className="space-y-8">
      <Card tone="contrast" className="border-contrast-line">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="contrast">{getPlanLabel(plan)}</Badge>
            <Badge tone={trackTheme.badgeTone}>{trackTheme.label}</Badge>
          </div>
          <PageHeader
            title={projectTitle}
            description={
              projectTrack === "research"
                ? "Generate the roadmap overview first, then open each step to keep the objective visible and unlock deeper research guidance with Pro."
                : "Generate the roadmap overview first, then open each step to keep the objective visible and unlock deeper build guidance with Pro."
            }
            className="text-paper [&_h1]:text-paper [&_p]:text-paper/72"
          />
          <GenerateRoadmapButton projectId={projectId} projectTrack={projectTrack} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="editorial-kicker">What happens next</p>
          <p className="mt-3 text-lg font-semibold text-ink">Sevri creates the milestone structure.</p>
        </Card>
        <Card tone="primary">
          <p className="editorial-kicker">Execution bias</p>
          <p className="mt-3 text-lg font-semibold text-ink">You will move one deliverable at a time.</p>
        </Card>
        <Card tone="blush">
          <p className="editorial-kicker">Scope discipline</p>
          <p className="mt-3 text-lg font-semibold text-ink">The roadmap will keep the finishable version visible.</p>
        </Card>
      </div>
    </div>
  );
}
