"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
  const [isSwitchingTrack, startTrackTransition] = useTransition();
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

  useEffect(() => {
    setRecommendations(initialRecommendations);
  }, [initialRecommendations]);

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
    if (track === activeTrack) return;
    setError(null);
    startTrackTransition(() => {
      router.push(`/recommendations?track=${track}`);
    });
  }

  const subtitle =
    activeTrack === "research"
      ? "Explore multiple research directions, then compare the method, evidence plan, and finish line before you commit."
      : "Explore multiple software directions, then compare the user, problem, and version you can actually ship before you commit.";
  const generateLabel =
    activeTrack === "research"
      ? recommendations.length ? "Refresh research board" : "Generate research board"
      : recommendations.length ? "Refresh software board" : "Generate software board";

  return (
    <div className="space-y-8">
      <div aria-live="polite" className="sr-only">
        {error ?? (isGenerating ? "Generating recommendations." : isSelectingId ? "Selecting recommendation." : "")}
      </div>

      {/* Page heading */}
      <div>
        <div className="kicker" style={{ marginBottom: 10 }}>
          <span className="star">✦</span>
          <span>PROJECT IDEA BOARD</span>
        </div>
        <h1 className="font-display text-5xl leading-[0.98] tracking-tight text-ink sm:text-7xl">
          three <span className="hl-yellow">actually</span> different<br />
          directions<span style={{ color: 'var(--pink)' }}>.</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, fontWeight: 500, color: 'var(--ink-soft)', marginTop: 20, maxWidth: 600 }}>
          {subtitle}
        </p>
      </div>

      {/* Stats strip */}
      <div className="coach px-7 py-5">
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
          <div>
            <div className="kicker" style={{ color: 'rgba(251,246,233,0.6)', marginBottom: 8 }}>Plan</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--paper)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>{getPlanLabel(plan)}</div>
          </div>
          <div>
            <div className="kicker" style={{ color: 'rgba(251,246,233,0.6)', marginBottom: 8 }}>Boards used</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--paper)', fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>
              {unlimitedGenerations || generationLimit === null
                ? localGenerationsUsed
                : `${localGenerationsUsed} / ${generationLimit}`}
            </div>
          </div>
          <div>
            <div className="kicker" style={{ color: 'rgba(251,246,233,0.6)', marginBottom: 8 }}>Track readiness</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--paper)' }}>{hasTrackIntake ? "Ready to compare" : "Setup needed"}</div>
          </div>
        </div>
      </div>

      {/* Track switcher — tab buttons */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {(['software', 'research'] as ProjectTrack[]).map((t) => (
          <button
            key={t}
            className={`tab ${activeTrack === t ? 'is-active' : ''}`}
            style={{ width: 'auto', minWidth: 160, justifyContent: 'center', textTransform: 'uppercase', letterSpacing: '.08em', fontFamily: 'var(--font-mono)', fontSize: 13, opacity: isSwitchingTrack && activeTrack !== t ? 0.6 : 1 }}
            onClick={() => switchTrack(t)}
            disabled={isSwitchingTrack}
          >
            {activeTrack === t && <span style={{ marginRight: 4 }}>→</span>}
            {t}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12 }}>
          <Badge tone={trackTheme.badgeTone}>{trackTheme.label}</Badge>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !canRegenerate || !hasTrackIntake}
            className="px-6"
          >
            {isGenerating ? "Generating..." : generateLabel}
          </Button>
        </div>
      </div>

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
            <Button href="/onboarding" className="px-6">
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
          className="grid gap-6 xl:grid-cols-3"
        >
          {recommendations.map((item, index) => {
            const ribbon = ribbons[item.id];
            const cardTone = ribbon === "Quickest to ship" ? "featured" : ribbon === "Most ambitious" ? "cyan" : "";
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
                <div className={`rec-card ${cardTone}`}>
                  {ribbon ? (
                    <div
                      className="ribbon"
                      style={{
                        background: cardTone === "featured" ? 'var(--ink)' : 'var(--ink)',
                        color: 'var(--paper)',
                      }}
                    >
                      {ribbon}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <span className="kicker">
                      <span className="star">✦</span>
                      OPTION 0{index + 1}
                    </span>
                    <span className="kicker" style={{ color: 'var(--ink-muted)' }}>
                      {difficultyLabel[item.difficulty] ?? item.difficulty}
                    </span>
                  </div>

                  <div>
                    <h2 className="title">
                      {safeRenderText(item.title, RECOMMENDATION_CARD_TITLE_SPEC).text}
                    </h2>
                    <p className="body" style={{ marginTop: 8 }}>
                      {safeRenderText(item.summary, RECOMMENDATION_CARD_PROSE_SPEC).text}
                    </p>
                  </div>

                  {/* Detail sections */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {details.map((detail) => (
                      <div key={detail.label} className="rounded-xl bg-ink/[0.04] px-3 py-2.5">
                        <p className="editorial-kicker" style={{ marginBottom: 4 }}>{detail.label}</p>
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)' }}>{detail.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Metrics grid */}
                  <div className="meta-grid">
                    <div>
                      <div className="k">Timeline</div>
                      <div className="v">{item.estimated_weeks} wks</div>
                    </div>
                    <div>
                      <div className="k">Weekly</div>
                      <div className="v">{item.weekly_hours ? `${item.weekly_hours} hrs` : "Flexible"}</div>
                    </div>
                    <div>
                      <div className="k">Finish</div>
                      <div className="v">{formatScore(item.finishability_score)}</div>
                    </div>
                    <div>
                      <div className="k">Wow</div>
                      <div className="v">{formatScore(item.impressiveness_score)}</div>
                    </div>
                  </div>

                  {/* Why it fits */}
                  <div>
                    <p className="editorial-kicker" style={{ marginBottom: 6 }}>Why it fits</p>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
                      {safeRenderText(item.why_it_fits, RECOMMENDATION_CARD_PROSE_SPEC).text}
                    </p>
                  </div>

                  {item.authenticity_note ? (
                    <div>
                      <p className="editorial-kicker" style={{ marginBottom: 6 }}>Authenticity note</p>
                      <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)' }}>{item.authenticity_note}</p>
                    </div>
                  ) : null}

                  {item.skills_demonstrated && item.skills_demonstrated.length ? (
                    <div>
                      <p className="editorial-kicker" style={{ marginBottom: 8 }}>Skills demonstrated</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {item.skills_demonstrated.slice(0, 4).map((skill) => (
                          <span key={skill} className="pill" style={{ fontSize: 9 }}>{skill}</span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Pick button — pinned to bottom */}
                  <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                    <Button
                      onClick={() => handleSelect(item.id)}
                      disabled={Boolean(isSelectingId)}
                      fullWidth
                    >
                      {isSelectingId === item.id
                        ? "Selecting..."
                        : item.project_track === "research"
                          ? "Choose this research direction"
                          : "Choose this software project"}
                    </Button>
                  </div>
                </div>
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

function formatScore(value?: number) {
  if (typeof value !== "number") return "—";
  return `${value}/10`;
}

function getSoftwareDetails(payload?: Record<string, unknown>) {
  return [
    { label: "Target user", value: getString(payload?.target_user, "A real person with a clear problem to solve.") },
    { label: "Problem statement", value: getString(payload?.problem_statement, "The problem definition will be clarified once you choose this direction.") },
    { label: "Core workflow", value: getString(payload?.core_workflow, "The first version of the workflow will stay intentionally narrow.") },
    { label: "MVP boundary", value: getString(payload?.mvp_boundary, "Keep the first version honest about what is in and out.") },
    { label: "Validation plan", value: getString(payload?.validation_plan, "Validate the product with a small set of realistic users or cases.") },
  ];
}

function getResearchDetails(payload?: Record<string, unknown>) {
  return [
    { label: "Research question", value: getString(payload?.research_question, "A focused question will be refined after you choose this direction.") },
    { label: "Methodology", value: getString(payload?.methodology, "A method will be chosen to match your current access and time.") },
    { label: "Evidence plan", value: getString(payload?.evidence_plan, "The plan will be shaped around evidence you can realistically gather.") },
    { label: "Scope boundaries", value: getString(payload?.scope_boundaries, "Keep the first version narrow enough to finish and defend.") },
    { label: "Limitation note", value: getString(payload?.limitation_note, "State the main limitation early so the work stays believable.") },
  ];
}

function getString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function deriveRibbons(items: RecommendationItem[]) {
  const ribbons: Record<string, string> = {};
  if (items.length === 0) return ribbons;

  const quickest = [...items].sort((a, b) => a.estimated_weeks - b.estimated_weeks)[0];
  ribbons[quickest.id] = "Quickest to ship";

  const remaining = items.filter((item) => item.id !== quickest.id);
  const ambitiousCandidate =
    [...remaining].sort((a, b) => {
      const difficultyDelta = (difficultyOrder[b.difficulty] ?? 0) - (difficultyOrder[a.difficulty] ?? 0);
      if (difficultyDelta !== 0) return difficultyDelta;
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
      if (weeksDelta !== 0) return weeksDelta;
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
