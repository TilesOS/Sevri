import { notFound } from "next/navigation";
import { getRequiredUser } from "@/lib/auth/guard";
import { getProjectWorkspace } from "@/lib/db/queries/projects";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MilestoneChecklist } from "@/components/project/milestone-checklist";
import { GenerateRoadmapButton } from "@/components/project/generate-roadmap-button";
import { hasReadmeExportAccess } from "@/lib/usage/limits";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRepoItems(value: unknown): Array<{ path: string; purpose: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof (item as { path?: unknown }).path === "string" &&
        typeof (item as { purpose?: unknown }).purpose === "string"
      ) {
        return { path: (item as { path: string }).path, purpose: (item as { purpose: string }).purpose };
      }

      return null;
    })
    .filter((item): item is { path: string; purpose: string } => item !== null);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getRequiredUser();
  const { id } = await params;

  let workspace;
  try {
    workspace = await getProjectWorkspace(id, user.id);
  } catch {
    notFound();
  }

  const plan = await getUserPlan(user.id);
  const projectTrack = workspace.project.project_track === "research" ? "research" : "software";

  if (!workspace.roadmap) {
    return (
      <div className="space-y-6">
        <Card className="space-y-3">
          <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
          <h1 className="text-2xl font-bold text-ink-900">{workspace.project.title}</h1>
          <p className="text-sm text-ink-700">
            {projectTrack === "research"
              ? "Generate your structured research plan to start execution."
              : "Generate your structured roadmap to start execution."}
          </p>
          <GenerateRoadmapButton projectId={workspace.project.id} projectTrack={projectTrack} />
        </Card>
      </div>
    );
  }

  const raw = asRecord(workspace.roadmap.raw_model_output_json);
  const featureLadder = asRecord(raw.feature_ladder ?? {});
  const explanationGuide = asRecord(raw.explanation_guide ?? workspace.roadmap.explanation_guide ?? {});
  const trackPayload = asRecord(workspace.roadmap.track_payload_json ?? raw.track_payload_json ?? {});
  const cutIfBehind = asStringArray(raw.cut_if_behind);
  const resumeBullets = asStringArray(explanationGuide.resume_bullets);
  const interviewTalkingPoints = asStringArray(explanationGuide.interview_talking_points);
  const mustHave = asStringArray(featureLadder.must_have);
  const shouldHave = asStringArray(featureLadder.should_have);
  const couldHave = asStringArray(featureLadder.could_have);
  const stretchGoals = asStringArray(workspace.roadmap.stretch_goals);
  const repoStructure = asRepoItems(workspace.roadmap.repo_structure);

  if (projectTrack === "research") {
    const stepByStep = asStringArray(trackPayload.step_by_step_plan);
    const timeline = asStringArray(trackPayload.timeline_and_milestones);
    const blockers = asStringArray(trackPayload.risks_and_blockers);
    const deliverables = asStringArray(trackPayload.final_deliverables);

    return (
      <div className="space-y-6">
        <Card className="space-y-2">
          <div className="flex items-center gap-3">
            <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
            <Badge className="bg-sky-500/15 text-sky-400">Research</Badge>
            <Badge className="bg-mint-100 text-mint-700">{workspace.project.status}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-ink-900">{workspace.project.title}</h1>
          <p className="text-sm text-ink-700">{workspace.roadmap.overview}</p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900">Research Question / Hypothesis</h2>
            <p className="text-sm text-ink-700">
              {String(trackPayload.research_question_or_hypothesis ?? "Define a focused student-scale question.")}
            </p>
            <h3 className="text-sm font-semibold text-ink-900">Methodology</h3>
            <p className="text-sm text-ink-700">{String(trackPayload.methodology ?? workspace.roadmap.mvp_scope)}</p>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900">Scope Boundaries</h2>
            <p className="text-sm text-ink-700">
              {String(trackPayload.scope_boundaries ?? "Keep one question and one primary methodology.")}
            </p>
            <h3 className="text-sm font-semibold text-ink-900">Why this fits you</h3>
            <p className="text-sm text-ink-700">
              {String(trackPayload.why_this_fits ?? "This direction balances ambition with realistic constraints.")}
            </p>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900">Step-by-step Plan</h2>
            <ul className="space-y-2 text-sm text-ink-700">
              {stepByStep.length
                ? stepByStep.map((step) => <li key={step}>- {step}</li>)
                : workspace.milestones.map((milestone) => (
                    <li key={milestone.id}>- {milestone.order_index + 1}. {milestone.title}</li>
                  ))}
            </ul>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900">Timeline and Milestones</h2>
            <ul className="space-y-2 text-sm text-ink-700">
              {timeline.length ? timeline.map((item) => <li key={item}>- {item}</li>) : <li>- Use milestone checklist below.</li>}
            </ul>
            <h3 className="pt-2 text-sm font-semibold text-ink-900">Risks / Blockers</h3>
            <ul className="space-y-2 text-sm text-ink-700">
              {blockers.length ? blockers.map((item) => <li key={item}>- {item}</li>) : <li>- No blockers highlighted.</li>}
            </ul>
          </Card>
        </div>

        <MilestoneChecklist milestones={workspace.milestones} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900">Final Deliverables</h2>
            <ul className="space-y-2 text-sm text-ink-700">
              {deliverables.length
                ? deliverables.map((item) => <li key={item}>- {item}</li>)
                : <li>- Paper, poster, or presentation deliverable set.</li>}
            </ul>
            <h3 className="pt-2 text-sm font-semibold text-ink-900">Positioning Angle</h3>
            <p className="text-sm text-ink-700">
              {String(
                trackPayload.portfolio_or_application_positioning ??
                  "Present this as disciplined inquiry with clear scope, evidence, and limitations.",
              )}
            </p>
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900">How to Explain This Project</h2>
            <p className="text-sm text-ink-700">{String(explanationGuide.elevator_pitch ?? "")}</p>
            <h3 className="text-sm font-semibold text-ink-900">Resume bullets</h3>
            <ul className="space-y-2 text-sm text-ink-700">
              {resumeBullets.map((bullet) => (
                <li key={bullet}>- {bullet}</li>
              ))}
            </ul>
            <h3 className="text-sm font-semibold text-ink-900">Interview talking points</h3>
            <ul className="space-y-2 text-sm text-ink-700">
              {interviewTalkingPoints.map((point) => (
                <li key={point}>- {point}</li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink-900">Research Brief Starter</h2>
            {hasReadmeExportAccess(plan) ? (
              <a
                href={`data:text/markdown;charset=utf-8,${encodeURIComponent(workspace.roadmap.readme_draft)}`}
                download={`${workspace.project.title.toLowerCase().replace(/\s+/g, "-")}-research-brief.md`}
                className="text-sm font-semibold text-ink-700"
              >
                Export .md
              </a>
            ) : (
              <span className="text-xs text-ink-500">Upgrade to Pro for export</span>
            )}
          </div>
          <pre className="overflow-x-auto rounded-lg border border-surface-border bg-surface-subtle p-4 text-xs text-ink-800">
            {workspace.roadmap.readme_draft}
          </pre>
        </Card>

        {repoStructure.length ? (
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900">Suggested Research File Structure</h2>
            <ul className="space-y-2 text-sm text-ink-700">
              {repoStructure.map((item) => (
                <li key={item.path}>
                  <span className="font-mono text-xs text-ink-900">{item.path}</span>: {item.purpose}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
          <Badge className="bg-mint-100 text-mint-700">{workspace.project.status}</Badge>
        </div>
        <h1 className="text-2xl font-bold text-ink-900">{workspace.project.title}</h1>
        <p className="text-sm text-ink-700">{workspace.roadmap.overview}</p>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">MVP scope</h2>
          <p className="text-sm text-ink-700">{workspace.roadmap.mvp_scope}</p>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">Feature ladder</h2>
          <LadderBlock title="Must have" items={mustHave} />
          <LadderBlock title="Should have" items={shouldHave} />
          <LadderBlock title="Could have" items={couldHave} />
        </Card>
      </div>

      <MilestoneChecklist milestones={workspace.milestones} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">Suggested repo structure</h2>
          <ul className="space-y-2 text-sm text-ink-700">
            {repoStructure.map((item) => (
              <li key={item.path}>
                <span className="font-mono text-xs text-ink-900">{item.path}</span>: {item.purpose}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">Cut this if you run behind</h2>
          <ul className="space-y-2 text-sm text-ink-700">
            {cutIfBehind.length ? cutIfBehind.map((item) => <li key={item}>- {item}</li>) : <li>- No cuts suggested</li>}
          </ul>
          <h3 className="pt-2 text-sm font-semibold text-ink-900">Stretch goals</h3>
          <ul className="space-y-2 text-sm text-ink-700">
            {stretchGoals.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-ink-900">How to explain this project</h2>
        <p className="text-sm text-ink-700">{String(explanationGuide.elevator_pitch ?? "")}</p>
        <h3 className="text-sm font-semibold text-ink-900">Resume bullets</h3>
        <ul className="space-y-2 text-sm text-ink-700">
          {resumeBullets.map((bullet) => (
            <li key={bullet}>- {bullet}</li>
          ))}
        </ul>
        <h3 className="text-sm font-semibold text-ink-900">Interview talking points</h3>
        <ul className="space-y-2 text-sm text-ink-700">
          {interviewTalkingPoints.map((point) => (
            <li key={point}>- {point}</li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink-900">README starter</h2>
          {hasReadmeExportAccess(plan) ? (
            <a
              href={`data:text/markdown;charset=utf-8,${encodeURIComponent(workspace.roadmap.readme_draft)}`}
              download={`${workspace.project.title.toLowerCase().replace(/\s+/g, "-")}-README.md`}
              className="text-sm font-semibold text-ink-700"
            >
              Export .md
            </a>
          ) : (
            <span className="text-xs text-ink-500">Upgrade to Pro for README export</span>
          )}
        </div>
        <pre className="overflow-x-auto rounded-lg border border-surface-border bg-surface-subtle p-4 text-xs text-ink-800">
          {workspace.roadmap.readme_draft}
        </pre>
      </Card>
    </div>
  );
}

function LadderBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-1 text-sm text-ink-700">
      <p className="font-semibold text-ink-900">{title}</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
