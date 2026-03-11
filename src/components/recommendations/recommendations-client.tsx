"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

interface RecommendationsClientProps {
  activeTrack: ProjectTrack;
  initialRecommendations: RecommendationItem[];
  plan: Plan;
  batchesUsed: number;
}

interface ResearchRecommendationPayload {
  project_title_or_direction?: string;
  research_question_or_hypothesis?: string;
  methodology?: string;
  scope_boundaries?: string;
  final_deliverables?: string[];
  portfolio_or_application_positioning?: string;
  key_risks?: string[];
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

    return batchesUsed < 1;
  }, [plan, batchesUsed]);

  async function handleGenerate() {
    setError(null);
    setIsGenerating(true);

    const normalizeRes = await fetch("/api/ai/normalize-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
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
      body: JSON.stringify({}),
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

  const title = activeTrack === "research" ? "Your research project directions" : "Your project recommendations";
  const subtitle =
    activeTrack === "research"
      ? "Choose one credible, finishable research direction with a grounded methodology and strong final deliverables."
      : "Choose one finishable project that still looks impressive in applications and interviews.";
  const generateLabel =
    activeTrack === "research"
      ? recommendations.length
        ? "Regenerate research options"
        : "Generate 3 research options"
      : recommendations.length
        ? "Regenerate"
        : "Generate 3 projects";

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
          <p className="text-sm text-ink-600">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
          <Badge className="bg-mint-100 text-mint-700">{activeTrack === "research" ? "Research" : "Software"}</Badge>
          <Button onClick={handleGenerate} disabled={isGenerating || !canRegenerate}>
            {isGenerating ? "Generating..." : generateLabel}
          </Button>
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

      <div className="grid gap-4 lg:grid-cols-3">
        {recommendations.map((item) => {
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
                    {researchPayload.research_question_or_hypothesis ?? "TBD during planning"}
                  </p>
                  <p>
                    <span className="font-semibold">Methodology:</span> {researchPayload.methodology ?? "Method to be finalized"}
                  </p>
                  <p>
                    <span className="font-semibold">Scope boundaries:</span>{" "}
                    {researchPayload.scope_boundaries ?? "Narrow scope with realistic constraints"}
                  </p>
                  <p>
                    <span className="font-semibold">Deliverables:</span>{" "}
                    {(researchPayload.final_deliverables ?? []).join(", ") || "Paper, poster, or presentation"}
                  </p>
                </div>
              ) : null}

              <div className="mt-auto space-y-2">
                <p className="text-xs text-ink-600">Skills: {item.skills_demonstrated.join(", ")}</p>
                <p className="text-xs text-ink-600">Tools/Resources: {item.tools_needed.join(", ")}</p>
                <Button onClick={() => handleSelect(item.id)} disabled={Boolean(isSelectingId)} className="w-full">
                  {isSelectingId === item.id
                    ? "Selecting..."
                    : isResearch
                      ? "Select this research direction"
                      : "Select this project"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
