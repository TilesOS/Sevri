import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

export function ProjectPitchKitView({ workspace }: { workspace: ProjectWorkspaceView }) {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Presentation"
        title="Present the project without losing the substance."
        description="Keep the positioning sharp. This page is for how you talk about the project, not how you execute it."
      />

      {workspace.elevatorPitch ? (
        <Card className="space-y-3">
          <p className="editorial-kicker">Elevator pitch</p>
          <p className="text-sm leading-6 text-ink-soft">{workspace.elevatorPitch}</p>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <p className="editorial-kicker">Resume bullets</p>
        {workspace.resumeBullets.length ? (
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            {workspace.resumeBullets.map((bullet) => (
              <li key={bullet} className="rounded-2xl bg-canvas px-4 py-3">
                {bullet}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-ink-soft">No resume bullets were generated yet for this project.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <p className="editorial-kicker">Talking points</p>
        {workspace.parsedTalkingPoints.length === workspace.talkingPoints.length && workspace.parsedTalkingPoints.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {workspace.parsedTalkingPoints.map((point) => (
              <div key={point.raw} className="rounded-2xl bg-canvas p-4">
                <p className="editorial-kicker">{point.label}</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{point.body}</p>
              </div>
            ))}
          </div>
        ) : workspace.talkingPoints.length ? (
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            {workspace.talkingPoints.map((point) => (
              <li key={point} className="rounded-2xl bg-canvas px-4 py-3">
                {point}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-ink-soft">No talking points were generated yet for this project.</p>
        )}
      </Card>
    </div>
  );
}
