import { Card } from "@/components/ui/card";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

const LENS_CARD_ACCENTS = ['var(--cyan)', 'var(--yellow)', 'var(--pink)', 'var(--green)', 'var(--cyan)', 'var(--yellow)'];

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
        <Card className="space-y-3" style={{ borderColor: 'var(--ink)', borderTop: '4px solid var(--cyan)', backgroundColor: 'rgba(91,208,214,0.06)' }}>
          <p className="editorial-kicker">Project brief</p>
          <p className="text-sm leading-6 text-ink-soft">{workspace.projectBrief}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {workspace.projectLens.map((item, index) => (
          <Card key={item.label} className="space-y-3" style={{ borderColor: 'var(--ink)', borderTop: `4px solid ${LENS_CARD_ACCENTS[index % LENS_CARD_ACCENTS.length]}` }}>
            <p className="editorial-kicker">{item.label}</p>
            <p className="text-sm leading-6 text-ink-soft">{item.value}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
