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

  if (!workspace.roadmap) {
    return (
      <div className="space-y-6">
        <Card className="space-y-3">
          <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
          <h1 className="text-2xl font-bold text-ink-900">{workspace.project.title}</h1>
          <p className="text-sm text-ink-700">Generate your structured roadmap to start execution.</p>
          <GenerateRoadmapButton projectId={workspace.project.id} />
        </Card>
      </div>
    );
  }

  const raw = workspace.roadmap.raw_model_output_json as Record<string, unknown>;
  const featureLadder = (raw.feature_ladder ?? {}) as Record<string, unknown>;
  const explanationGuide = (raw.explanation_guide ?? workspace.roadmap.explanation_guide ?? {}) as Record<string, unknown>;
  const cutIfBehind = asStringArray(raw.cut_if_behind);
  const resumeBullets = asStringArray(explanationGuide.resume_bullets);
  const interviewTalkingPoints = asStringArray(explanationGuide.interview_talking_points);
  const mustHave = asStringArray(featureLadder.must_have);
  const shouldHave = asStringArray(featureLadder.should_have);
  const couldHave = asStringArray(featureLadder.could_have);
  const stretchGoals = asStringArray(workspace.roadmap.stretch_goals);
  const repoStructure = asRepoItems(workspace.roadmap.repo_structure);

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
        <pre className="overflow-x-auto rounded-lg bg-ink-900 p-4 text-xs text-ink-100">{workspace.roadmap.readme_draft}</pre>
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