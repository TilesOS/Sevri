import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

export function ProjectScopeView({ workspace }: { workspace: ProjectWorkspaceView }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Stay finishable" title="Scope & Guardrails" description="Protect the version that ships. Keep the project honest, narrow, and finishable." />

      <Card className="space-y-4 bg-surface" elevation="soft">
        <p className="text-xs font-medium text-ink-muted">Core scope</p>
        <h2 className="text-lg font-semibold text-ink">Protect the MVP before you chase the stretch version.</h2>
        <p className="text-sm leading-6 text-ink-soft">{workspace.roadmap?.mvp_scope}</p>
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-medium text-ink">Deliverables to protect</p>
        <ul className="space-y-3 text-sm leading-6 text-ink-soft">
          {workspace.keyDeliverables.map((deliverable) => (
            <li key={deliverable} className="rounded-xl bg-surface-butter px-4 py-3">
              {deliverable}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-medium text-ink">Delay these until later</p>
        {workspace.stretchGoals.length ? (
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            {workspace.stretchGoals.map((goal) => (
              <li key={goal} className="rounded-xl bg-primary-soft px-4 py-3">
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
