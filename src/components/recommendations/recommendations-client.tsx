"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLAN_LIMITS } from "@/lib/usage/limits";
import type { Plan, ProjectTrack } from "@/types/domain";

interface RecommendationItem {
  id: string;
  project_track: ProjectTrack;
  title: string;
  summary: string;
  rationale: string;
  difficulty: string;
  estimated_weeks: number;
  weekly_hours: number;
  skills_demonstrated: string[];
  tools_needed: string[];
  impressiveness_score: number;
  finishability_score: number;
  authenticity_note: string;
  track_payload_json?: Record<string, unknown>;
}

interface TrackAvailability {
  software: { hasIntake: boolean; recommendationCount: number };
  research: { hasIntake: boolean; recommendationCount: number };
}

interface RecommendationsClientProps {
  activeTrack: ProjectTrack;
  initialRecommendations: RecommendationItem[];
  plan: Plan;
  batchesUsed: number;
  trackAvailability: TrackAvailability;
}

interface SoftwareRecommendationPayload {
  target_user?: string;
  problem_statement?: string;
  core_workflow?: string;
  mvp_boundary?: string;
  validation_plan?: string;
}

interface ResearchRecommendationPayload {
  research_question?: string;
  research_question_or_hypothesis?: string;
  hypothesis_or_focus?: string;
  methodology?: string;
  evidence_or_data_plan?: string;
  scope_boundaries?: string;
  limitation_note?: string;
}

function asSoftwarePayload(value: unknown): SoftwareRecommendationPayload {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as SoftwareRecommendationPayload;
}

function asResearchPayload(value: unknown): ResearchRecommendationPayload {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as ResearchRecommendationPayload;
}

export function RecommendationsClient({
  activeTrack,
  initialRecommendations,
  plan,
  batchesUsed,
  trackAvailability,
}: RecommendationsClientProps) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelectingId, setIsSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRegenerate = useMemo(() => {
    if (plan === "pro_monthly") {
      return true;
    }

    return batchesUsed < PLAN_LIMITS[plan].recommendation_batches;
  }, [plan, batchesUsed]);

  const hasTrackIntake = trackAvailability[activeTrack].hasIntake;

  async function handleGenerate() {
    setError(null);
    setIsGenerating(true);

    const normalizeRes = await fetch("/api/ai/normalize-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_track: activeTrack }),
    });

    if (!normalizeRes.ok) {
      const body = (await normalizeRes.json().catch(() => null)) as { error?: string; details?: string } | null;
      setError(body?.details ?? body?.error ?? "Failed to normalize profile.");
      setIsGenerating(false);
      return;
    }

    const recommendationsRes = await fetch("/api/ai/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_track: activeTrack }),
    });

    const recommendationsBody = (await recommendationsRes.json().catch(() => null)) as
      | { recommendations?: RecommendationItem[]; error?: string; details?: string }
      | null;

    if (!recommendationsRes.ok || !recommendationsBody?.recommendations) {
      setError(recommendationsBody?.details ?? recommendationsBody?.error ?? "Failed to generate recommendations.");
      setIsGenerating(false);
      return;
    }

    setRecommendations(recommendationsBody.recommendations);
    setIsGenerating(false);
    router.refresh();
  }

  async function handleSelect(recommendationId: string) {
    setError(null);
    setIsSelectingId(recommendationId);

    const response = await fetch("/api/recommendations/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendation_id: recommendationId }),
    });

    const body = (await response.json().catch(() => null)) as { project_id?: string; error?: string } | null;

    if (!response.ok || !body?.project_id) {
      setError(body?.error ?? "Failed to select recommendation.");
      setIsSelectingId(null);
      return;
    }

    router.push(`/project/${body.project_id}`);
    router.refresh();
  }

  function switchTrack(track: ProjectTrack) {
    if (track === activeTrack) {
      return;
    }

    setRecommendations([]);
    setError(null);
    router.push(`/recommendations?track=${track}`);
  }

  const title = activeTrack === "research" ? "Your research project directions" : "Your software project directions";
  const subtitle =
    activeTrack === "research"
      ? "Choose one question-centered research direction with a credible method, evidence plan, and believable scope."
      : "Choose one domain-grounded software build with a real user, real workflow, and a believable MVP.";
  const generateLabel =
    activeTrack === "research"
      ? recommendations.length
        ? "Regenerate research options"
        : "Generate 3 research options"
      : recommendations.length
        ? "Regenerate software options"
        : "Generate 3 software options";

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
            <p className="text-sm text-ink-600">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
            <Button onClick={handleGenerate} disabled={isGenerating || !canRegenerate || !hasTrackIntake}>
              {isGenerating ? "Generating..." : generateLabel}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {(["software", "research"] as ProjectTrack[]).map((track) => {
            const isActive = track === activeTrack;

            return (
              <button
                key={track}
                type="button"
                onClick={() => switchTrack(track)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  isActive ? "border-mint-500 bg-mint-100 text-ink-900" : "border-surface-border bg-surface-card text-ink-700"
                }`}
              >
                {track === "software" ? "Software" : "Research"}
              </button>
            );
          })}
        </div>
      </Card>

      {!canRegenerate ? (
        <Card className="border-yellow-500/20 bg-yellow-500/10">
          <p className="text-sm text-ink-800">
            Free plan limit reached. Upgrade on the billing page to unlock more recommendation refreshes.
          </p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-500/20 bg-red-500/10">
          <p className="text-sm text-red-400">{error}</p>
        </Card>
      ) : null}

      {!hasTrackIntake ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">
            {activeTrack === "research" ? "Research track not set up yet" : "Software track not set up yet"}
          </h2>
          <p className="text-sm text-ink-700">
            Run onboarding again and choose the {activeTrack === "research" ? "Research Project" : "Software Project"} track to
            generate recommendations for it.
          </p>
          <div>
            <Button onClick={() => router.push("/onboarding")}>Open onboarding</Button>
          </div>
        </Card>
      ) : recommendations.length === 0 ? (
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">No saved recommendations for this track yet</h2>
          <p className="text-sm text-ink-700">
            Generate a fresh batch and Sevri will keep the output anchored to this track&apos;s latest onboarding profile.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {recommendations.map((item) => {
          const softwarePayload = asSoftwarePayload(item.track_payload_json);
          const researchPayload = asResearchPayload(item.track_payload_json);
          const isResearch = item.project_track === "research";

          return (
            <Card key={item.id} className="flex h-full flex-col gap-4">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-ink-900">{item.title}</h2>
                <p className="text-sm text-ink-700">{item.summary}</p>
              </div>

              <div className="space-y-1 text-sm text-ink-700">
                <p>
                  <span className="font-semibold">Why it fits:</span> {item.rationale}
                </p>
                <p>
                  <span className="font-semibold">Difficulty:</span> {item.difficulty}
                </p>
                <p>
                  <span className="font-semibold">Timeline:</span> {item.estimated_weeks} weeks at {item.weekly_hours}
                  h/week
                </p>
                <p>
                  <span className="font-semibold">Impressiveness:</span> {item.impressiveness_score}/10
                </p>
                <p>
                  <span className="font-semibold">Finishability:</span> {item.finishability_score}/10
                </p>
                <p>
                  <span className="font-semibold">Authenticity note:</span> {item.authenticity_note}
                </p>
              </div>

              {isResearch ? (
                <div className="space-y-2 rounded-lg border border-surface-border bg-surface-subtle p-3 text-xs text-ink-700">
                  <p>
                    <span className="font-semibold">Research question:</span>{" "}
                    {researchPayload.research_question ?? researchPayload.research_question_or_hypothesis ?? "TBD during planning"}
                  </p>
                  <p>
                    <span className="font-semibold">Focus:</span>{" "}
                    {researchPayload.hypothesis_or_focus ?? "Narrow the main comparison or measurable relationship"}
                  </p>
                  <p>
                    <span className="font-semibold">Methodology:</span> {researchPayload.methodology ?? "Method to be finalized"}
                  </p>
                  <p>
                    <span className="font-semibold">Evidence plan:</span>{" "}
                    {researchPayload.evidence_or_data_plan ?? "Accessible data or evidence source"}
                  </p>
                  <p>
                    <span className="font-semibold">Scope boundaries:</span>{" "}
                    {researchPayload.scope_boundaries ?? "Keep one question and one evidence source"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 rounded-lg border border-surface-border bg-surface-subtle p-3 text-xs text-ink-700">
                  <p>
                    <span className="font-semibold">Target user:</span> {softwarePayload.target_user ?? "A clearly defined niche user"}
                  </p>
                  <p>
                    <span className="font-semibold">Problem:</span> {softwarePayload.problem_statement ?? "Solve one real domain problem"}
                  </p>
                  <p>
                    <span className="font-semibold">Core workflow:</span>{" "}
                    {softwarePayload.core_workflow ?? "One end-to-end workflow from input to useful output"}
                  </p>
                  <p>
                    <span className="font-semibold">MVP boundary:</span> {softwarePayload.mvp_boundary ?? "Ship one narrow workflow first"}
                  </p>
                  <p>
                    <span className="font-semibold">Validation:</span> {softwarePayload.validation_plan ?? "Test the workflow on realistic cases"}
                  </p>
                </div>
              )}

              <div className="mt-auto space-y-2">
                <p className="text-xs text-ink-600">Skills: {item.skills_demonstrated.join(", ")}</p>
                <p className="text-xs text-ink-600">Tools/Resources: {item.tools_needed.join(", ")}</p>
                <Button onClick={() => handleSelect(item.id)} disabled={Boolean(isSelectingId)} className="w-full">
                  {isSelectingId === item.id
                    ? "Selecting..."
                    : isResearch
                      ? "Save this research project"
                      : "Save this software project"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
