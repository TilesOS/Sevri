"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { canGenerateRecommendations, getGenerationLimit, hasUnlimitedGenerations } from "@/lib/usage/limits";
import { safeRenderText } from "@/lib/ai/content-quality";
import {
  RECOMMENDATION_CARD_PROSE_SPEC,
  RECOMMENDATION_CARD_TITLE_SPEC,
} from "@/lib/ai/content-quality-specs";
import { getPlanLabel, trackThemes } from "@/components/theme/theme-utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { GenerationFeedbackForm } from "@/components/shared/generation-feedback-form";
import type { Plan, ProjectTrack } from "@/types/domain";

interface RecommendationItem {
  id: string;
  normalized_profile_id?: string;
  project_track: ProjectTrack;
  title: string;
  summary: string;
  why_it_fits: string;
  difficulty: string;
  estimated_weeks: number;
  weekly_hours?: number;
  skills_demonstrated?: string[];
  tools_needed?: string[];
  impressiveness_score?: number;
  finishability_score?: number;
  authenticity_note?: string;
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
  generationsUsed: number;
  trackAvailability: TrackAvailability;
}

interface RecommendationsResponseBody {
  recommendations?: RecommendationItem[];
  error?: string;
  details?: string;
  code?: string;
  generations_used?: number;
  generation_limit?: number | null;
}

const difficultyOrder: Record<string, number> = {
  beginner: 1,
  beginner_intermediate: 1,
  intermediate: 2,
  intermediate_advanced: 3,
  advanced: 3,
};

const difficultyLabel: Record<string, string> = {
  beginner: "Beginner",
  beginner_intermediate: "Beginner",
  intermediate: "Intermediate",
  intermediate_advanced: "Advanced",
  advanced: "Advanced",
};

export function RecommendationsClient({
  activeTrack,
  initialRecommendations,
  plan,
  generationsUsed,
  trackAvailability,
}: RecommendationsClientProps) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [localGenerationsUsed, setLocalGenerationsUsed] = useState(generationsUsed);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelectingId, setIsSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generationLimit = getGenerationLimit(plan);
  const unlimitedGenerations = hasUnlimitedGenerations(plan);
  const canRegenerate = useMemo(
    () => canGenerateRecommendations(plan, localGenerationsUsed),
    [plan, localGenerationsUsed],
  );

  const hasTrackIntake = trackAvailability[activeTrack].hasIntake;
  const ribbons = useMemo(() => deriveRibbons(recommendations), [recommendations]);
  const trackTheme = trackThemes[activeTrack];

  useEffect(() => {
    setLocalGenerationsUsed(generationsUsed);
  }, [generationsUsed]);

  async function handleGenerate() {
    setError(null);
    setIsGenerating(true);

    const response = await fetch("/api/ai/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_track: activeTrack }),
    });

    const body = (await response.json().catch(() => null)) as RecommendationsResponseBody | null;

    if (!response.ok || !body?.recommendations) {
      if (typeof body?.generations_used === "number") {
        setLocalGenerationsUsed(body.generations_used);
      }
      setError(body?.error ?? body?.details ?? "Failed to generate recommendations.");
      setIsGenerating(false);
      return;
    }

    setRecommendations(body.recommendations);
    setLocalGenerationsUsed((current) =>
      typeof body.generations_used === "number" ? body.generations_used : current + 1,
    );
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

  const title =
    activeTrack === "research" ? "Compare your research directions." : "Compare your software directions.";
  const subtitle =
    activeTrack === "research"
      ? "Explore multiple research directions, then compare the method, evidence plan, and finish line before you commit."
      : "Explore multiple software directions, then compare the user, problem, and version you can actually ship before you commit.";
  const generateLabel =
    activeTrack === "research"
      ? recommendations.length
        ? "Refresh research board"
        : "Generate research board"
      : recommendations.length
        ? "Refresh software board"
        : "Generate software board";

  return (
    <div className="space-y-8">
      <div aria-live="polite" className="sr-only">
        {error ?? (isGenerating ? "Generating recommendations." : isSelectingId ? "Selecting recommendation." : "")}
      </div>

      <Card tone="contrast" elevation="none" className="border-contrast-line">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <PageHeader
              eyebrow="Project idea board"
              title={title}
              description={subtitle}
              className="text-paper [&_.editorial-kicker]:text-paper/55 [&_h1]:text-paper [&_p]:text-paper/72"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="contrast">{getPlanLabel(plan)}</Badge>
            <Badge tone={trackTheme.badgeTone}>{trackTheme.label}</Badge>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !canRegenerate || !hasTrackIntake}
              className="rounded-full px-6"
            >
              {isGenerating ? "Generating..." : generateLabel}
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card tone="contrast" elevation="none" className="border-contrast-line bg-white/[0.04]">
            <p className="editorial-kicker text-paper/55">Plan</p>
            <p className="mt-3 text-3xl font-semibold text-paper">{getPlanLabel(plan)}</p>
          </Card>
          <Card tone="contrast" elevation="none" className="border-contrast-line bg-white/[0.04]">
            <p className="editorial-kicker text-paper/55">Idea boards used</p>
            <p className="mt-3 text-3xl font-semibold text-paper">
              {unlimitedGenerations || generationLimit === null
                ? localGenerationsUsed
                : `${localGenerationsUsed} / ${generationLimit}`}
            </p>
          </Card>
          <Card tone="contrast" elevation="none" className="border-contrast-line bg-white/[0.04]">
            <p className="editorial-kicker text-paper/55">Track readiness</p>
            <p className="mt-3 text-lg font-semibold text-paper">{hasTrackIntake ? "Ready to compare" : "Setup needed"}</p>
          </Card>
        </div>
      </Card>

      <SegmentedControl
        label="Switch track"
        value={activeTrack}
        onChange={switchTrack}
        options={[
          {
            value: "software",
            label: "Software",
            description: "Compare user, problem, and core workflow.",
          },
          {
            value: "research",
            label: "Research",
            description: "Compare question, method, and evidence plan.",
          },
        ]}
      />

      {!canRegenerate ? (
        <Alert
          tone="warning"
          heading={
            generationLimit === null
              ? "Generation limit reached"
              : `You've used your ${generationLimit} free idea boards`
          }
        >
          You&apos;ve explored multiple directions already. Upgrade in account settings to keep refining new boards while your saved options stay available.
        </Alert>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {!hasTrackIntake ? (
        <Card className="space-y-4" elevation="none">
          <h2 className="text-2xl font-semibold text-ink">
            {activeTrack === "research" ? "Set up your research track first." : "Set up your software track first."}
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            Run onboarding again and choose the {activeTrack === "research" ? "Research Project" : "Software Project"} track to generate recommendations for it.
          </p>
          <div>
            <Button href="/onboarding" className="rounded-full px-6">
              Open onboarding
            </Button>
          </div>
        </Card>
      ) : recommendations.length === 0 ? (
        <Card className="space-y-4" elevation="none">
          <h2 className="text-2xl font-semibold text-ink">No saved options for this track yet.</h2>
          <p className="text-sm leading-6 text-ink-soft">
            Generate a fresh idea board and Sevri will return three distinct directions built from your current context.
          </p>
        </Card>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${activeTrack}-${recommendations.map((item) => item.id).join(",") || "empty"}`}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="grid gap-4 xl:grid-cols-3"
        >
          {recommendations.map((item, index) => {
            const ribbon = ribbons[item.id];
            const details =
              item.project_track === "research"
                ? getResearchDetails(item.track_payload_json)
                : getSoftwareDetails(item.track_payload_json);

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: index * 0.06, ease: "easeOut" }}
              >
                <Card className="flex h-full flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={item.project_track === "research" ? "research" : "software"}>
                        {item.project_track === "research" ? "Research" : "Software"}
                      </Badge>
                      {ribbon ? <Badge tone="accent">{ribbon}</Badge> : null}
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                      {difficultyLabel[item.difficulty] ?? item.difficulty}
                    </p>
                  </div>

                  <div className="mt-5 space-y-3">
                    <h2 className="text-2xl font-semibold text-ink">
                      {safeRenderText(item.title, RECOMMENDATION_CARD_TITLE_SPEC).text}
                    </h2>
                    <p className="text-sm leading-6 text-ink-soft">
                      {safeRenderText(item.summary, RECOMMENDATION_CARD_PROSE_SPEC).text}
                    </p>
                  </div>

                  <div className="mt-6 grid gap-3">
                    {details.map((detail) => (
                      <div key={detail.label} className="rounded-lg bg-canvas p-4">
                        <p className="editorial-kicker">{detail.label}</p>
                        <p className="mt-2 text-sm leading-6 text-ink">{detail.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 space-y-4 rounded-lg bg-canvas p-5">
                    <div className="grid grid-cols-2 gap-4">
                      <Metric label="Estimated timeline" value={`${item.estimated_weeks} weeks`} />
                      <Metric
                        label="Weekly load"
                        value={item.weekly_hours ? `${item.weekly_hours} hrs` : "Flexible"}
                      />
                      <Metric
                        label="Finishability"
                        value={formatScore(item.finishability_score)}
                      />
                      <Metric
                        label="Impressiveness"
                        value={formatScore(item.impressiveness_score)}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="editorial-kicker">Why it fits</p>
                      <p className="text-sm leading-6 text-ink-soft">
                        {safeRenderText(item.why_it_fits, RECOMMENDATION_CARD_PROSE_SPEC).text}
                      </p>
                    </div>

                    {item.authenticity_note ? (
                      <div className="space-y-2">
                        <p className="editorial-kicker">Authenticity note</p>
                        <p className="text-sm leading-6 text-ink-soft">{item.authenticity_note}</p>
                      </div>
                    ) : null}
                  </div>

                  {item.skills_demonstrated && item.skills_demonstrated.length ? (
                    <div className="mt-6">
                      <p className="editorial-kicker">Skills demonstrated</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.skills_demonstrated.slice(0, 4).map((skill) => (
                          <span key={skill} className="rounded-full bg-surface-strong px-3 py-1 text-xs font-semibold text-ink-soft">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-auto pt-8">
                    <Button
                      onClick={() => handleSelect(item.id)}
                      disabled={Boolean(isSelectingId)}
                      fullWidth
                      className="rounded-full"
                    >
                      {isSelectingId === item.id
                        ? "Selecting..."
                        : item.project_track === "research"
                          ? "Choose this research direction"
                          : "Choose this software project"}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>

      {recommendations.length > 0 && recommendations[0]?.normalized_profile_id ? (
        <GenerationFeedbackForm
          stage="recommendations"
          normalizedProfileId={recommendations[0].normalized_profile_id}
          recommendations={recommendations.map((recommendation) => ({
            id: recommendation.id,
            title: recommendation.title,
          }))}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="editorial-kicker">{label}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function formatScore(value?: number) {
  if (typeof value !== "number") {
    return "Not scored";
  }

  return `${value}/10`;
}

function getSoftwareDetails(payload?: Record<string, unknown>) {
  return [
    {
      label: "Target user",
      value: getString(payload?.target_user, "A real person with a clear problem to solve."),
    },
    {
      label: "Problem statement",
      value: getString(payload?.problem_statement, "The problem definition will be clarified once you choose this direction."),
    },
    {
      label: "Core workflow",
      value: getString(payload?.core_workflow, "The first version of the workflow will stay intentionally narrow."),
    },
    {
      label: "MVP boundary",
      value: getString(payload?.mvp_boundary, "Keep the first version honest about what is in and out."),
    },
    {
      label: "Validation plan",
      value: getString(payload?.validation_plan, "Validate the product with a small set of realistic users or cases."),
    },
  ];
}

function getResearchDetails(payload?: Record<string, unknown>) {
  return [
    {
      label: "Research question",
      value: getString(payload?.research_question, "A focused question will be refined after you choose this direction."),
    },
    {
      label: "Methodology",
      value: getString(payload?.methodology, "A method will be chosen to match your current access and time."),
    },
    {
      label: "Evidence plan",
      value: getString(payload?.evidence_plan, "The plan will be shaped around evidence you can realistically gather."),
    },
    {
      label: "Scope boundaries",
      value: getString(payload?.scope_boundaries, "Keep the first version narrow enough to finish and defend."),
    },
    {
      label: "Limitation note",
      value: getString(payload?.limitation_note, "State the main limitation early so the work stays believable."),
    },
  ];
}

function getString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function deriveRibbons(items: RecommendationItem[]) {
  const ribbons: Record<string, string> = {};

  if (items.length === 0) {
    return ribbons;
  }

  const quickest = [...items].sort((a, b) => a.estimated_weeks - b.estimated_weeks)[0];
  ribbons[quickest.id] = "Quickest to ship";

  const remaining = items.filter((item) => item.id !== quickest.id);
  const ambitiousCandidate =
    [...remaining].sort((a, b) => {
      const difficultyDelta = (difficultyOrder[b.difficulty] ?? 0) - (difficultyOrder[a.difficulty] ?? 0);
      if (difficultyDelta !== 0) {
        return difficultyDelta;
      }
      return b.estimated_weeks - a.estimated_weeks;
    })[0] ?? quickest;

  if (!ribbons[ambitiousCandidate.id]) {
    ribbons[ambitiousCandidate.id] = "Most ambitious";
  }

  const balancedCandidate =
    items.find((item) => !ribbons[item.id]) ??
    [...items].sort((a, b) => {
      const weeksDelta =
        Math.abs(a.estimated_weeks - averageWeeks(items)) - Math.abs(b.estimated_weeks - averageWeeks(items));
      if (weeksDelta !== 0) {
        return weeksDelta;
      }
      return (difficultyOrder[a.difficulty] ?? 0) - (difficultyOrder[b.difficulty] ?? 0);
    })[0];

  if (balancedCandidate && !ribbons[balancedCandidate.id]) {
    ribbons[balancedCandidate.id] = "Balanced pick";
  }

  return ribbons;
}

function averageWeeks(items: RecommendationItem[]) {
  return items.reduce((total, item) => total + item.estimated_weeks, 0) / items.length;
}
