"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Plan } from "@/types/domain";

interface RecommendationItem {
  id: string;
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
}

interface RecommendationsClientProps {
  initialRecommendations: RecommendationItem[];
  plan: Plan;
  batchesUsed: number;
}

export function RecommendationsClient({
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
      const body = (await normalizeRes.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to normalize profile.");
      setIsGenerating(false);
      return;
    }

    const recommendationsRes = await fetch("/api/ai/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const recommendationsBody = (await recommendationsRes.json().catch(() => null)) as
      | { recommendations?: RecommendationItem[]; error?: string }
      | null;

    if (!recommendationsRes.ok || !recommendationsBody?.recommendations) {
      setError(recommendationsBody?.error ?? "Failed to generate recommendations.");
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

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Your project recommendations</h1>
          <p className="text-sm text-ink-600">
            Choose one finishable project that still looks impressive in applications and interviews.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
          <Button onClick={handleGenerate} disabled={isGenerating || !canRegenerate}>
            {isGenerating ? "Generating..." : recommendations.length ? "Regenerate" : "Generate 3 projects"}
          </Button>
        </div>
      </Card>

      {!canRegenerate ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Free plan limit reached. Upgrade on the billing page to unlock more recommendation refreshes.
          </p>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {recommendations.map((item) => (
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
                <span className="font-semibold">Timeline:</span> {item.estimated_weeks} weeks at {item.weekly_hours}h/week
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
            <div className="mt-auto space-y-2">
              <p className="text-xs text-ink-600">Skills: {item.skills_demonstrated.join(", ")}</p>
              <p className="text-xs text-ink-600">Tools: {item.tools_needed.join(", ")}</p>
              <Button onClick={() => handleSelect(item.id)} disabled={Boolean(isSelectingId)} className="w-full">
                {isSelectingId === item.id ? "Selecting..." : "Select this project"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}