"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { canGenerateRecommendations, getGenerationLimit, hasUnlimitedGenerations } from "@/lib/usage/limits";
import { safeRenderText } from "@/lib/ai/content-quality";
import {
  RECOMMENDATION_CARD_PROSE_SPEC,
  RECOMMENDATION_CARD_TITLE_SPEC,
} from "@/lib/ai/content-quality-specs";
import { toUserFacingError } from "@/lib/errors/user-messages";
import { asSentence } from "@/lib/text/prose";
import { toStudentVoice } from "@/lib/text/student-voice";
import { getPlanLabel, trackThemes } from "@/components/theme/theme-utils";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Disclosure } from "@/components/ui/disclosure";
import { PageHeader } from "@/components/ui/page-header";
import { Toolbar } from "@/components/ui/toolbar";
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

/**
 * The four numbers every option is compared on, defined once so the card labels
 * and the legend below the board can never describe them differently.
 */
const IDEA_METRICS: Array<{
  key: string;
  label: string;
  explanation: string;
  getValue: (item: RecommendationItem) => string;
}> = [
  {
    key: "timeline",
    label: "Timeline",
    explanation: "Calendar weeks from first step to a finished first version.",
    getValue: (item) => `${item.estimated_weeks} wks`,
  },
  {
    key: "weekly",
    label: "Weekly",
    explanation: "Hours a week this pace assumes, based on the time you said you have.",
    getValue: (item) => (item.weekly_hours ? `${item.weekly_hours} hrs` : "Flexible"),
  },
  {
    key: "finishability",
    label: "Finishability",
    explanation: "How likely you are to finish this one, out of 10. Higher means safer scope.",
    getValue: (item) => formatScore(item.finishability_score),
  },
  {
    key: "impressiveness",
    label: "Impressiveness",
    explanation: "How much the finished work says about your judgment, out of 10.",
    getValue: (item) => formatScore(item.impressiveness_score),
  },
];

interface SelectResponseBody {
  project_id?: string;
  project_title?: string;
  project_track?: string;
  code?: "duplicate_project";
  error?: string;
}

/** An existing project for the option the student just picked again. */
interface DuplicatePrompt {
  recommendationId: string;
  projectId: string;
  projectTitle: string;
}

interface BoardState {
  track: ProjectTrack;
  items: RecommendationItem[];
  /** Server board identity at the time this state was adopted. */
  serverKey: string;
}

// The board is keyed by track as well as option ids. Cards are only ever
// rendered from a board whose track matches the active one, so the header,
// badge, and cards cannot disagree about which track is on screen.
function boardKeyFor(track: ProjectTrack, items: RecommendationItem[]) {
  return `${track}:${items.map((item) => item.id).join(",")}`;
}

export function RecommendationsClient({
  activeTrack,
  initialRecommendations,
  plan,
  generationsUsed,
  trackAvailability,
}: RecommendationsClientProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [isSwitchingTrack, startTrackTransition] = useTransition();
  const [board, setBoard] = useState<BoardState>(() => ({
    track: activeTrack,
    items: initialRecommendations,
    serverKey: boardKeyFor(activeTrack, initialRecommendations),
  }));
  const [localGenerationsUsed, setLocalGenerationsUsed] = useState(generationsUsed);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSelectingId, setIsSelectingId] = useState<string | null>(null);
  const [pendingTrack, setPendingTrack] = useState<ProjectTrack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePrompt | null>(null);
  const selectionInFlightRef = useRef(false);
  const selectionOperationIdsRef = useRef(new Map<string, string>());

  // Adopt server data during render rather than in an effect, so a track switch
  // never commits a frame where the board and the header disagree. A locally
  // generated board keeps its own serverKey, so it survives until the server
  // catches up.
  const serverBoardKey = boardKeyFor(activeTrack, initialRecommendations);
  if (board.serverKey !== serverBoardKey) {
    setBoard({ track: activeTrack, items: initialRecommendations, serverKey: serverBoardKey });
  }

  const recommendations = useMemo(
    () => (board.track === activeTrack ? board.items : []),
    [board, activeTrack],
  );

  const generationLimit = getGenerationLimit(plan);
  const unlimitedGenerations = hasUnlimitedGenerations(plan);
  const canRegenerate = useMemo(
    () => canGenerateRecommendations(plan, localGenerationsUsed),
    [plan, localGenerationsUsed],
  );

  // While a switch is in flight the whole page commits to the requested track,
  // with the board itself showing a loading state until its data arrives.
  const displayedTrack = pendingTrack ?? activeTrack;
  const hasTrackIntake = trackAvailability[displayedTrack].hasIntake;
  const ribbons = useMemo(() => deriveRibbons(recommendations), [recommendations]);
  const trackTheme = trackThemes[displayedTrack];

  useEffect(() => {
    setLocalGenerationsUsed(generationsUsed);
  }, [generationsUsed]);

  useEffect(() => {
    if (!isSwitchingTrack) {
      setPendingTrack(null);
    }
  }, [isSwitchingTrack]);

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
      setError(
        toUserFacingError(body?.error ?? body?.details, "We couldn't generate an idea board. Try again in a moment."),
      );
      setIsGenerating(false);
      return;
    }

    const generated = body.recommendations;
    setBoard((current) => ({ track: activeTrack, items: generated, serverKey: current.serverKey }));
    setLocalGenerationsUsed((current) =>
      typeof body.generations_used === "number" ? body.generations_used : current + 1,
    );
    setIsGenerating(false);
    router.refresh();
  }

  async function handleSelect(recommendationId: string, allowDuplicate = false) {
    // A ref, not the state flag: two clicks inside one render pass would both
    // read the pre-update state and fire two inserts.
    if (selectionInFlightRef.current) {
      return;
    }
    selectionInFlightRef.current = true;

    setError(null);
    // Confirming a second copy keeps the prompt on screen so the button can show
    // its pending state; a fresh pick clears whatever prompt was showing.
    if (!allowDuplicate) {
      setDuplicatePrompt(null);
    }
    setIsSelectingId(recommendationId);
    const operationKey = `${recommendationId}:${allowDuplicate ? "confirmed-duplicate" : "default"}`;
    const operationId = selectionOperationIdsRef.current.get(operationKey) ?? crypto.randomUUID();
    selectionOperationIdsRef.current.set(operationKey, operationId);

    function release() {
      selectionInFlightRef.current = false;
      setIsSelectingId(null);
    }

    let result: { response: Response; body: SelectResponseBody | null } | null = null;

    try {
      const response = await fetch("/api/recommendations/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation_id: recommendationId,
          operation_id: operationId,
          ...(allowDuplicate ? { allow_duplicate: true } : {}),
        }),
      });
      result = { response, body: await response.json().catch(() => null) };
    } catch {
      setError("We couldn't reach Sevri. Check your connection and try again.");
      release();
      return;
    }

    const { response, body } = result;

    // This idea already has a project. Starting a second copy is a real choice,
    // so it is asked for explicitly rather than done silently.
    if (response.status === 409 && body?.code === "duplicate_project" && body.project_id) {
      selectionOperationIdsRef.current.delete(operationKey);
      setDuplicatePrompt({
        recommendationId,
        projectId: body.project_id,
        projectTitle: body.project_title ?? "your existing project",
      });
      release();
      return;
    }

    if (!response.ok || !body?.project_id) {
      setError(toUserFacingError(body?.error, "We couldn't start that project. Try again in a moment."));
      release();
      return;
    }

    // The guard is deliberately left engaged here: the buttons stay disabled
    // while the router navigates to the project that was just created.
    selectionOperationIdsRef.current.delete(operationKey);
    router.push(`/project/${body.project_id}`);
    router.refresh();
  }

  function switchTrack(track: ProjectTrack) {
    if (track === activeTrack) return;
    setError(null);
    setDuplicatePrompt(null);
    setPendingTrack(track);
    startTrackTransition(() => {
      router.push(`/recommendations?track=${track}`);
    });
  }

  const subtitle =
    displayedTrack === "research"
      ? "Explore multiple research directions, then compare the method, evidence plan, and finish line before you commit."
      : "Explore multiple software directions, then compare the user, problem, and version you can actually ship before you commit.";
  const generateLabel =
    displayedTrack === "research"
      ? recommendations.length ? "Refresh research board" : "Generate research board"
      : recommendations.length ? "Refresh software board" : "Generate software board";

  return (
    <div className="space-y-8">
      <div aria-live="polite" className="sr-only">
        {error ??
          (duplicatePrompt
            ? `You already started this idea as ${duplicatePrompt.projectTitle}. Choose whether to open it or start another copy.`
            : isSwitchingTrack
            ? `Loading the ${displayedTrack === "research" ? "research" : "software"} idea board.`
            : isGenerating
              ? "Generating recommendations."
              : isSelectingId
                ? "Selecting recommendation."
                : "")}
      </div>

      <PageHeader eyebrow="Idea board" title="Project ideas" description={subtitle} />

      {/* Stats strip */}
      <div className="grid overflow-hidden rounded-xl border border-line bg-paper sm:grid-cols-3">
          <div className="border-b border-line p-4 sm:border-b-0 sm:border-r">
            <p className="text-xs font-medium text-ink-muted">Plan</p>
            <p className="mt-2 text-xl font-semibold text-ink">{getPlanLabel(plan)}</p>
          </div>
          <div className="border-b border-line p-4 sm:border-b-0 sm:border-r">
            <p className="text-xs font-medium text-ink-muted">Boards used</p>
            <p className="mt-2 text-xl font-semibold text-ink">
              {unlimitedGenerations || generationLimit === null
                ? localGenerationsUsed
                : `${localGenerationsUsed} / ${generationLimit}`}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium text-ink-muted">
              {displayedTrack === "research" ? "Research onboarding" : "Software onboarding"}
            </p>
            {/* "Ready to compare" told students nothing about what was ready.
                This says what the state is and, when it isn't done, what to do. */}
            <p className="mt-2 text-xl font-semibold text-ink">{hasTrackIntake ? "Complete" : "Not done yet"}</p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              {hasTrackIntake
                ? "Your answers are saved, so boards for this track use them."
                : "Answer this track's questions to generate a board."}
            </p>
          </div>
      </div>

      {/* Track switcher — tab buttons */}
      <Toolbar className="border-y">
        <div className="inline-flex rounded-lg bg-surface p-1" role="tablist" aria-label="Project track">
          {(["software", "research"] as ProjectTrack[]).map((track) => (
            <button
              key={track}
              role="tab"
              aria-selected={displayedTrack === track}
              className={displayedTrack === track ? "rounded-md bg-paper px-4 py-1.5 text-sm font-medium text-ink shadow-soft" : "rounded-md px-4 py-1.5 text-sm text-ink-muted hover:text-ink"}
              onClick={() => switchTrack(track)}
              disabled={isSwitchingTrack}
            >
              {track === "software" ? "Software" : "Research"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={trackTheme.badgeTone}>{trackTheme.label}</Badge>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || isSwitchingTrack || !canRegenerate || !hasTrackIntake}
            className="px-6"
          >
            {isGenerating ? "Generating..." : isSwitchingTrack ? "Loading board..." : generateLabel}
          </Button>
        </div>
      </Toolbar>

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

      {duplicatePrompt ? (
        <Alert tone="warning" heading="You already started this idea">
          <div className="space-y-4">
            <p>
              &ldquo;{duplicatePrompt.projectTitle}&rdquo; came from this option. Opening it keeps your roadmap,
              steps, and submitted work. Starting another copy gives you a second, separate project.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button href={`/project/${duplicatePrompt.projectId}`}>Open the existing project</Button>
              <Button
                variant="outline"
                onClick={() => handleSelect(duplicatePrompt.recommendationId, true)}
                disabled={Boolean(isSelectingId)}
              >
                {isSelectingId === duplicatePrompt.recommendationId ? "Starting..." : "Start another copy"}
              </Button>
              <Button variant="ghost" onClick={() => setDuplicatePrompt(null)} disabled={Boolean(isSelectingId)}>
                Cancel
              </Button>
            </div>
          </div>
        </Alert>
      ) : null}

      {isSwitchingTrack ? null : !hasTrackIntake ? (
        <Card className="space-y-4" elevation="none">
          <h2 className="text-2xl font-semibold text-ink">
            {displayedTrack === "research" ? "Set up your research track first." : "Set up your software track first."}
          </h2>
          <p className="text-sm leading-6 text-ink-soft">
            Run onboarding again and choose the {displayedTrack === "research" ? "Research Project" : "Software Project"} track to generate recommendations for it.
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

      {isSwitchingTrack ? (
        <div className="grid gap-6 xl:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((placeholder) => (
            <Card key={placeholder} className="space-y-4" elevation="none">
              <div className="h-3 w-20 rounded-full bg-surface motion-safe:animate-pulse" />
              <div className="h-6 w-3/4 rounded-full bg-surface motion-safe:animate-pulse" />
              <div className="h-3 w-full rounded-full bg-surface motion-safe:animate-pulse" />
              <div className="h-3 w-5/6 rounded-full bg-surface motion-safe:animate-pulse" />
              <div className="h-16 w-full rounded-xl bg-surface motion-safe:animate-pulse" />
              <div className="h-9 w-full rounded-[10px] bg-surface motion-safe:animate-pulse" />
            </Card>
          ))}
        </div>
      ) : (
        <motion.div
          key={boardKeyFor(activeTrack, recommendations)}
          initial={prefersReducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.16, ease: "easeOut" }}
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
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.16, delay: index * 0.03, ease: "easeOut" }
                }
              >
                <div className={`rec-card ${cardTone}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-ink-muted">Option {index + 1}</span>
                    <div className="flex items-center gap-2">
                      {ribbon ? <Badge tone="neutral">{ribbon}</Badge> : null}
                      <Badge tone="neutral">{difficultyLabel[item.difficulty] ?? item.difficulty}</Badge>
                    </div>
                  </div>

                  <div>
                    <h2 className="title">
                      {safeRenderText(item.title, RECOMMENDATION_CARD_TITLE_SPEC).text}
                    </h2>
                    <p className="body mt-2">
                      {safeRenderText(item.summary, RECOMMENDATION_CARD_PROSE_SPEC).text}
                    </p>
                  </div>

                  {/* Metrics grid. Labels are the whole word — "FINISH 8/10"
                      and "WOW 6/10" left students guessing at the two numbers
                      the comparison actually turns on. */}
                  <div className="meta-grid">
                    {IDEA_METRICS.map((metric) => (
                      <div key={metric.key}>
                        <div className="k" title={metric.explanation}>
                          {metric.label}
                        </div>
                        <div className="v">{metric.getValue(item)}</div>
                      </div>
                    ))}
                  </div>

                  <Disclosure title="View full details" className="border-line bg-surface/40">
                    <div className="space-y-5">
                      <div className="space-y-3">
                        {details.map((detail) => (
                          <div key={detail.label}>
                            <p className="text-xs font-medium text-ink-muted">{detail.label}</p>
                            <p className="mt-1 text-sm leading-6 text-ink-soft">{detail.value}</p>
                          </div>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-ink-muted">Why it fits</p>
                        <p className="mt-1 text-sm leading-6 text-ink-soft">{safeRenderText(item.why_it_fits, RECOMMENDATION_CARD_PROSE_SPEC).text}</p>
                      </div>
                      {item.authenticity_note ? (
                        <div>
                          <p className="text-xs font-medium text-ink-muted">Why this stays yours</p>
                          <p className="mt-1 text-sm leading-6 text-ink-soft">
                            {asSentence(toStudentVoice(item.authenticity_note))}
                          </p>
                        </div>
                      ) : null}
                      {item.skills_demonstrated && item.skills_demonstrated.length ? (
                        <div>
                          <p className="text-xs font-medium text-ink-muted">Skills demonstrated</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {item.skills_demonstrated.map((skill) => <Badge key={skill} tone="neutral">{skill}</Badge>)}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </Disclosure>

                  {/* Pick button — pinned to bottom */}
                  <div className="mt-auto pt-2">
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
      )}

      {!isSwitchingTrack && recommendations.length > 0 ? <IdeaMetricLegend /> : null}

      {!isSwitchingTrack && recommendations.length > 0 && recommendations[0]?.normalized_profile_id ? (
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

/**
 * Spells out the four numbers on every card. The tooltips on the cards help a
 * mouse user; this is the version everyone else gets, including on touch.
 */
function IdeaMetricLegend() {
  return (
    <Card tone="subtle" className="space-y-4" elevation="none">
      <div className="space-y-1">
        <p className="editorial-kicker">How to read these numbers</p>
        <p className="text-sm leading-6 text-ink-soft">
          Every option is scored the same four ways, so the trade-off between finishing and reaching is visible
          before you commit.
        </p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        {IDEA_METRICS.map((metric) => (
          <div key={metric.key} className="space-y-1">
            <dt className="text-sm font-semibold text-ink">{metric.label}</dt>
            <dd className="text-sm leading-6 text-ink-soft">{metric.explanation}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
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
