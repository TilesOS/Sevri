import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

export function ProjectScopeView({ workspace }: { workspace: ProjectWorkspaceView }) {
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Stay finishable" title="Scope & Guardrails" description="Protect the version that ships. Keep the project honest, narrow, and finishable." />

      <Card className="space-y-4 bg-surface" elevation="soft">
        <p className="text-xs font-medium text-ink-muted">Core scope</p>
        <h2 className="text-lg font-semibold text-ink">Protect the core before you chase the stretch version.</h2>
        <p className="text-sm leading-6 text-ink-soft">{workspace.coreScope}</p>
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
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink">Worth doing later</p>
          <p className="text-xs leading-5 text-ink-muted">
            These are parked, not cancelled. Come back to them once the core is solid.
          </p>
        </div>
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
            Nothing is parked yet, which is a good reason to keep the current roadmap narrow.
          </p>
        )}
      </Card>
    </div>
  );
}
