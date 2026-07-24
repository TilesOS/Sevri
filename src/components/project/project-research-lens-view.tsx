import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

export function ProjectResearchLensView({ workspace }: { workspace: ProjectWorkspaceView }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Research lens" title={workspace.projectTrack === "research" ? "Keep the question visible" : "Keep the user visible"} description="Stay anchored in the problem, audience, and context while you work." />

      {workspace.projectBrief ? (
        <Card className="space-y-3 bg-surface" elevation="soft">
          <p className="text-sm font-medium text-ink">Project brief</p>
          <p className="text-sm leading-6 text-ink-soft">{workspace.projectBrief}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {workspace.projectLens.map((item) => (
          <Card key={item.label} className="space-y-3" elevation="soft">
            <p className="text-xs font-medium text-ink-muted">{item.label}</p>
            <p className="text-sm leading-6 text-ink-soft">{item.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
