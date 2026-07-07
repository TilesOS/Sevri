import { Card } from "@/components/ui/card";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

export function ProjectResearchLensView({ workspace }: { workspace: ProjectWorkspaceView }) {
  return (
    <div className="space-y-8">
      <div>
        <div className="kicker" style={{ marginBottom: 10 }}>
          <span className="star">✦</span>
          <span style={{ color: 'var(--ink-muted)' }}>~ research lens ~</span>
        </div>
        <h1 className="display" style={{ margin: 0 }}>
          {workspace.projectTrack === "research" ? (
            <>Keep the <span className="hl-yellow">question</span> visible<span style={{ color: 'var(--pink)' }}>.</span></>
          ) : (
            <>Keep the <span className="hl-yellow">user</span> visible<span style={{ color: 'var(--pink)' }}>.</span></>
          )}
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 16, maxWidth: 600, lineHeight: 1.6 }}>
          This is the framing page. Use it to stay anchored in the problem, audience, and context while you work.
        </p>
      </div>

      {workspace.projectBrief ? (
        <Card className="space-y-3 bg-surface-mint" elevation="soft">
          <p className="editorial-kicker">Project brief</p>
          <p className="text-sm leading-6 text-ink-soft">{workspace.projectBrief}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {workspace.projectLens.map((item, index) => (
          <Card key={item.label} tone={index % 3 === 0 ? "blush" : index % 3 === 1 ? "subtle" : "butter"} className="space-y-3" elevation="soft">
            <p className="editorial-kicker">{item.label}</p>
            <p className="text-sm leading-6 text-ink-soft">{item.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
