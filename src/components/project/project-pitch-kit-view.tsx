import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ReadmeDiffSection } from "@/components/project/readme-diff-section";
import { PageHeader } from "@/components/ui/page-header";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

export function ProjectPitchKitView({ workspace }: { workspace: ProjectWorkspaceView }) {
  const readmeDraft =
    typeof workspace.roadmap?.project_overview_draft === "string" ? workspace.roadmap.project_overview_draft : "";
  const cachedReadme = workspace.githubLink?.cached_readme ?? "";
  const showReadmeDiff =
    workspace.githubLink?.status === "active" &&
    cachedReadme.trim().length > 0 &&
    readmeDraft.trim().length > 0 &&
    cachedReadme.trim() !== readmeDraft.trim();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Presentation" title="Present without losing the substance" description="Keep the positioning sharp. This page is for how you talk about the project, not how you execute it." />

      {showReadmeDiff ? (
        <ReadmeDiffSection cachedReadme={cachedReadme} readmeDraft={readmeDraft} />
      ) : null}

      {workspace.pitchKit.isDraft ? (
        <Alert tone="info" heading="Draft — refine the wording before you use it.">
          This pitch kit was assembled from your project&apos;s scope rather than written for you. It is
          accurate, but read it aloud and put it in your own words first.
        </Alert>
      ) : null}

      {workspace.elevatorPitch ? (
        <Card className="space-y-3 bg-surface" elevation="soft">
          <p className="text-sm font-medium text-ink">Elevator pitch</p>
          <p className="text-sm leading-6 text-ink-soft">{workspace.elevatorPitch}</p>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <p className="text-sm font-medium text-ink">Resume bullets</p>
        {workspace.resumeBullets.length ? (
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            {workspace.resumeBullets.map((bullet) => (
              <li key={bullet} className="rounded-xl bg-surface px-4 py-3">
                {bullet}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-6 text-ink-soft">No resume bullets were generated yet for this project.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-medium text-ink">Talking points</p>
        {workspace.parsedTalkingPoints.length === workspace.talkingPoints.length && workspace.parsedTalkingPoints.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {workspace.parsedTalkingPoints.map((point) => (
              <div key={point.raw} className="rounded-xl bg-surface p-4">
                <p className="text-xs font-medium text-ink-muted">{point.label}</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{point.body}</p>
              </div>
            ))}
          </div>
        ) : workspace.talkingPoints.length ? (
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            {workspace.talkingPoints.map((point) => (
              <li key={point} className="rounded-xl bg-surface px-4 py-3">
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
