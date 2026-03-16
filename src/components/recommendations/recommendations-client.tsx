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
  why_it_fits: string;
  difficulty: string;
  estimated_weeks: number;
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

    const response = await fetch("/api/ai/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_track: activeTrack }),
    });

    const body = (await response.json().catch(() => null)) as
      | { recommendations?: RecommendationItem[]; error?: string; details?: string }
      | null;

    if (!response.ok || !body?.recommendations) {
      setError(body?.details ?? body?.error ?? "Failed to generate recommendations.");
      setIsGenerating(false);
      return;
    }

    setRecommendations(body.recommendations);
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

  const title = activeTrack === "research" ? "Choose your research direction" : "Choose your software project";
  const subtitle =
    activeTrack === "research"
      ? "Pick one concrete direction now. Sevri will build the roadmap overview after you choose."
      : "Pick one concrete build now. Sevri will create the execution roadmap right after selection.";
  const generateLabel =
    activeTrack === "research"
      ? recommendations.length
        ? "Refresh research options"
        : "Generate 3 research options"
      : recommendations.length
        ? "Refresh software options"
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
          <h2 className="text-lg font-semibold text-ink-900">No saved options for this track yet</h2>
          <p className="text-sm text-ink-700">
            Generate a fresh batch and Sevri will return 3 concise, track-specific options for you to choose from.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {recommendations.map((item) => {
          const isResearch = item.project_track === "research";

          return (
            <Card key={item.id} className="flex h-full flex-col gap-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge className={isResearch ? "bg-sky-500/15 text-sky-400" : ""}>
                    {isResearch ? "Research" : "Software"}
                  </Badge>
                  <span className="text-xs font-medium uppercase tracking-[0.16em] text-ink-500">{item.difficulty}</span>
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-ink-900">{item.title}</h2>
                  <p className="text-sm text-ink-700">{item.summary}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-surface-border bg-surface-subtle p-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">Why It Fits</p>
                  <p className="text-sm text-ink-800">{item.why_it_fits}</p>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm text-ink-700">
                  <span>Estimated timeline</span>
                  <span className="font-semibold text-ink-900">{item.estimated_weeks} weeks</span>
                </div>
              </div>

              <div className="mt-auto">
                <Button onClick={() => handleSelect(item.id)} disabled={Boolean(isSelectingId)} className="w-full">
                  {isSelectingId === item.id
                    ? "Selecting..."
                    : isResearch
                      ? "Choose this research direction"
                      : "Choose this software project"}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
