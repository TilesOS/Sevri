import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

export function ProjectResearchLensView({ workspace }: { workspace: ProjectWorkspaceView }) {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Research lens"
        title={workspace.projectTrack === "research" ? "Keep the question and method visible." : "Keep the user and workflow visible."}
        description="This is the framing page. Use it to stay anchored in the problem, audience, and context while you work."
      />

      {workspace.projectBrief ? (
        <Card className="space-y-3">
          <p className="editorial-kicker">Project brief</p>
          <p className="text-sm leading-6 text-ink-soft">{workspace.projectBrief}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {workspace.projectLens.map((item) => (
          <Card key={item.label} className="space-y-3">
            <p className="editorial-kicker">{item.label}</p>
            <p className="text-sm leading-6 text-ink-soft">{item.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
