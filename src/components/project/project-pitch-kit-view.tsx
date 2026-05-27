import { Card } from "@/components/ui/card";
import { ReadmeDiffSection } from "@/components/project/readme-diff-section";
import type { ProjectWorkspaceView } from "@/lib/projects/workspace";

const TALKING_POINT_ACCENTS = ['var(--yellow)', 'var(--cyan)', 'var(--pink)', 'var(--green)'];

export function ProjectPitchKitView({ workspace }: { workspace: ProjectWorkspaceView }) {
  const readmeDraft =
    typeof workspace.roadmap?.readme_draft === "string" ? workspace.roadmap.readme_draft : "";
  const cachedReadme = workspace.githubLink?.cached_readme ?? "";
  const showReadmeDiff =
    workspace.projectTrack === "software" &&
    workspace.githubLink?.status === "active" &&
    cachedReadme.trim().length > 0 &&
    readmeDraft.trim().length > 0 &&
    cachedReadme.trim() !== readmeDraft.trim();

  return (
    <div className="space-y-8">
      <div>
        <div className="kicker" style={{ marginBottom: 10 }}>
          <span className="star">✦</span>
          <span style={{ color: 'var(--ink-muted)' }}>~ presentation ~</span>
        </div>
        <h1 className="display" style={{ margin: 0 }}>
          Present without losing the <span className="hl-yellow">substance</span>
          <span style={{ color: 'var(--pink)' }}>.</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 16, maxWidth: 600, lineHeight: 1.6 }}>
          Keep the positioning sharp. This page is for how you talk about the project, not how you execute it.
        </p>
      </div>

      {showReadmeDiff ? (
        <ReadmeDiffSection cachedReadme={cachedReadme} readmeDraft={readmeDraft} />
      ) : null}

      {workspace.elevatorPitch ? (
        <Card className="space-y-3" style={{ borderColor: 'var(--ink)', borderTop: '4px solid var(--cyan)', backgroundColor: 'rgba(91,208,214,0.06)' }}>
          <p className="editorial-kicker">Elevator pitch</p>
          <p className="text-sm leading-6 text-ink-soft">{workspace.elevatorPitch}</p>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <p className="editorial-kicker">Resume bullets</p>
        {workspace.resumeBullets.length ? (
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            {workspace.resumeBullets.map((bullet, index) => (
              <li key={bullet} className="rounded-md bg-canvas px-4 py-3" style={{ borderLeft: `3px solid ${TALKING_POINT_ACCENTS[index % TALKING_POINT_ACCENTS.length]}` }}>
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
            {workspace.parsedTalkingPoints.map((point, index) => (
              <div key={point.raw} className="rounded-md bg-canvas p-4" style={{ borderTop: `3px solid ${TALKING_POINT_ACCENTS[index % TALKING_POINT_ACCENTS.length]}` }}>
                <p className="editorial-kicker">{point.label}</p>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{point.body}</p>
              </div>
            ))}
          </div>
        ) : workspace.talkingPoints.length ? (
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            {workspace.talkingPoints.map((point, index) => (
              <li key={point} className="rounded-md bg-canvas px-4 py-3" style={{ borderLeft: `3px solid ${TALKING_POINT_ACCENTS[index % TALKING_POINT_ACCENTS.length]}` }}>
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
