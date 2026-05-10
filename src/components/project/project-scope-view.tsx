import { Card } from "@/components/ui/card";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

export function ProjectScopeView({ workspace }: { workspace: ProjectWorkspaceView }) {
  return (
    <div className="space-y-8">
      <div>
        <div className="kicker" style={{ marginBottom: 10 }}>
          <span className="star">✦</span>
          <span style={{ color: 'var(--ink-muted)' }}>~ stay finishable ~</span>
        </div>
        <h1 className="display" style={{ margin: 0 }}>
          <span className="hl-yellow">Scope</span>
          <span> & Guardrails</span>
          <span style={{ color: 'var(--cyan)' }}>.</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 16, maxWidth: 600, lineHeight: 1.6 }}>
          Protect the version that ships. Everything here is about keeping the project honest, narrow, and finishable.
        </p>
      </div>

      <Card className="space-y-4" style={{ borderColor: 'var(--ink)', borderTop: '4px solid var(--cyan)', backgroundColor: 'rgba(91,208,214,0.06)' }}>
        <p className="editorial-kicker">Core scope</p>
        <h2 className="text-3xl font-semibold text-ink">Protect the MVP before you chase the stretch version.</h2>
        <p className="text-sm leading-6 text-ink-soft">{workspace.roadmap?.mvp_scope}</p>
      </Card>

      <Card className="space-y-4">
        <p className="editorial-kicker">Deliverables to protect</p>
        <ul className="space-y-3 text-sm leading-6 text-ink-soft">
          {workspace.keyDeliverables.map((deliverable) => (
            <li key={deliverable} className="rounded-md bg-canvas px-4 py-3" style={{ borderLeft: '3px solid var(--yellow)' }}>
              {deliverable}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-4">
        <p className="editorial-kicker">Delay these until later</p>
        {workspace.stretchGoals.length ? (
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            {workspace.stretchGoals.map((goal) => (
              <li key={goal} className="rounded-md bg-canvas px-4 py-3" style={{ borderLeft: '3px solid var(--pink)' }}>
                {goal}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-ink-soft">
            No explicit stretch goals were stored, which is a good reason to keep the current roadmap narrow.
          </p>
        )}
      </Card>
    </div>
  );
}
