"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Clock3, RefreshCw, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toUserFacingError } from "@/lib/errors/user-messages";
import type { Plan, RepositoryRelevance } from "@/types/domain";

interface RecommendationItem {
  id: string;
  normalized_profile_id: string;
  title: string;
  summary: string;
  why_it_fits: string;
  project_kind_label: string;
  repository_relevance: RepositoryRelevance | string;
  difficulty: string;
  estimated_weeks: number;
  weekly_hours: number;
  skills_demonstrated: string[];
  tools_needed: string[];
  impressiveness_score: number;
  finishability_score: number;
  authenticity_note: string;
  project_blueprint_json: {
    central_challenge?: string;
    approach?: string;
    primary_artifacts?: string[];
    proof_of_success?: string[];
    scope_boundary?: string;
    resources_needed?: string[];
    safety_ethics_notes?: string[];
  };
  grounding_sources?: Array<{ title: string; url: string }>;
}

interface RecommendationsClientProps {
  initialRecommendations: RecommendationItem[];
  plan: Plan;
  generationsUsed: number;
  availability: { hasIntake: boolean; recommendationCount: number };
}

const tierMeta = [
  { label: "Focused", description: "The smallest serious version with a complete proof loop." },
  { label: "Stretch", description: "A different direction that teaches one important new technique." },
  { label: "Ambitious", description: "The hardest realistic option with the strongest credible ceiling." },
] as const;

const difficultyOrder: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-0000-4000-8000-000000000000`;
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold text-ink-muted">{title}</h3>
      <ul className="space-y-2 text-sm leading-6 text-ink-soft">
        {items.map((item) => <li key={item} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span>{item}</span></li>)}
      </ul>
    </section>
  );
}

export function RecommendationsClient({
  initialRecommendations,
  plan,
  generationsUsed: initialGenerationsUsed,
  availability,
}: RecommendationsClientProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialRecommendations);
  const [generationsUsed, setGenerationsUsed] = useState(initialGenerationsUsed);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSignal, setFeedbackSignal] = useState<"good" | "mixed" | "bad" | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState("");
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const freeLimit = plan === "free" ? 2 : null;
  const canGenerate = availability.hasIntake && (freeLimit === null || generationsUsed < freeLimit);

  const contextId = useMemo(() => items[0]?.normalized_profile_id ?? null, [items]);
  const orderedItems = useMemo(
    () => [...items].sort((a, b) => (difficultyOrder[a.difficulty] ?? 1) - (difficultyOrder[b.difficulty] ?? 1) || a.id.localeCompare(b.id)),
    [items],
  );

  async function generate() {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json() as { recommendations?: RecommendationItem[]; generations_used?: number; error?: string };
      if (!response.ok || !payload.recommendations) throw new Error(payload.error || "Could not generate project directions.");
      setItems(payload.recommendations);
      setGenerationsUsed(payload.generations_used ?? generationsUsed + 1);
      setFeedbackSignal(null);
      setFeedbackNotes("");
      setFeedbackSaved(false);
    } catch (generationError) {
      setError(toUserFacingError(generationError, "We couldn't generate a new board. Try again."));
    } finally {
      setIsGenerating(false);
    }
  }

  async function select(item: RecommendationItem, allowDuplicate = false) {
    setSelectingId(item.id);
    setError(null);
    const response = await fetch("/api/recommendations/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendation_id: item.id, operation_id: uuid(), allow_duplicate: allowDuplicate }),
    });
    const payload = await response.json() as { project_id?: string; code?: string; error?: string };
    if (response.status === 409 && payload.code === "duplicate_project" && !allowDuplicate) {
      if (window.confirm("You already started this direction. Create another copy?")) {
        setSelectingId(null);
        return select(item, true);
      }
    }
    if (!response.ok || !payload.project_id) {
      setError(payload.error || "We couldn't start that project.");
      setSelectingId(null);
      return;
    }
    router.push(`/project/${payload.project_id}`);
    router.refresh();
  }

  async function saveFeedback() {
    if (!feedbackSignal || !contextId) return;
    setError(null);
    const response = await fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: "recommendations", signal: feedbackSignal, notes: feedbackNotes, normalized_profile_id: contextId }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error || "Could not save feedback.");
      return;
    }
    setFeedbackSaved(true);
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-7">
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" aria-hidden="true" />Project directions</div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">Compare three ways forward.</h1>
          <p className="max-w-2xl text-base leading-7 text-ink-soft">Each direction names what you will make, how you will approach it, and what would prove it worked.</p>
        </div>
        <Button onClick={generate} disabled={!canGenerate || isGenerating} leadingIcon={<RefreshCw className="h-4 w-4" />}>
          {isGenerating ? "Building three directions…" : items.length ? "Refresh board" : "Generate directions"}
        </Button>
      </header>

      {!availability.hasIntake ? <Alert tone="warning" heading="Complete onboarding first.">Your interests, purpose, preferred shapes, and real constraints are what make these directions useful.</Alert> : null}
      {freeLimit !== null && generationsUsed >= freeLimit ? <Alert tone="info" heading="You used your free idea boards.">Your existing directions remain available. Upgrade when you want another comparison.</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {items.length > 0 ? (
        <div className="grid items-start gap-5 xl:grid-cols-3">
          {orderedItems.map((item, index) => {
            const tier = tierMeta[index] ?? tierMeta[1];
            const blueprint = item.project_blueprint_json ?? {};
            return (
              <Card key={item.id} padding="none" elevation={index === 1 ? "lifted" : "soft"} className="overflow-hidden">
                <div className="space-y-4 bg-surface/70 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2"><Badge tone={index === 1 ? "accent" : "neutral"}>{tier.label}</Badge><Badge tone="neutral">{item.project_kind_label}</Badge></div>
                  <div><h2 className="text-xl font-semibold tracking-[-0.02em] text-ink">{item.title}</h2><p className="mt-2 text-sm leading-6 text-ink-soft">{item.summary}</p></div>
                  <p className="text-xs leading-5 text-ink-muted">{tier.description}</p>
                  <div className="flex items-center gap-4 text-xs font-medium text-ink-muted"><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />{item.estimated_weeks} weeks</span><span>{item.weekly_hours} hrs/week</span></div>
                </div>
                <div className="space-y-6 p-6">
                  <section className="space-y-2"><h3 className="text-xs font-semibold text-ink-muted">Why it fits</h3><p className="text-sm leading-6 text-ink-soft">{item.why_it_fits}</p></section>
                  <ListSection title="What you’ll make" items={blueprint.primary_artifacts ?? []} />
                  <section className="space-y-2"><h3 className="text-xs font-semibold text-ink-muted">How you’ll do it</h3><p className="text-sm leading-6 text-ink-soft">{blueprint.approach}</p></section>
                  <ListSection title="What proves it worked" items={blueprint.proof_of_success ?? []} />
                  <ListSection title="What you need" items={blueprint.resources_needed ?? item.tools_needed ?? []} />
                  <section className="space-y-2"><h3 className="text-xs font-semibold text-ink-muted">Keep it in scope</h3><p className="text-sm leading-6 text-ink-soft">{blueprint.scope_boundary}</p></section>
                  {(blueprint.safety_ethics_notes?.length ?? 0) > 0 ? <ListSection title="Safety and ethics" items={blueprint.safety_ethics_notes ?? []} /> : null}
                  {item.repository_relevance !== "not_needed" ? <Alert tone="info" heading={item.repository_relevance === "recommended" ? "A repository would strengthen this project." : "A repository is optional."}>Use GitHub for files, version history, or documentation if it serves the work. It is never required.</Alert> : null}
                  <Button fullWidth onClick={() => select(item)} disabled={selectingId !== null} trailingIcon={<ArrowRight className="h-4 w-4" />}>{selectingId === item.id ? "Starting project…" : "Choose this project"}</Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : availability.hasIntake ? (
        <Card tone="subtle" className="py-12 text-center"><h2 className="text-xl font-semibold text-ink">Your comparison board is ready to be built.</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-soft">You will get a Focused, Stretch, and Ambitious direction grounded in the same real-world constraints.</p></Card>
      ) : null}

      {items.length > 0 && contextId ? (
        <Card tone="subtle" className="space-y-5">
          <div><h2 className="text-lg font-semibold text-ink">Help the next comparison get sharper.</h2><p className="mt-1 text-sm text-ink-soft">How useful was this mix of directions?</p></div>
          <div className="flex flex-wrap gap-2">{(["good", "mixed", "bad"] as const).map((signal) => <Button key={signal} size="sm" variant={feedbackSignal === signal ? "primary" : "outline"} onClick={() => { setFeedbackSignal(signal); setFeedbackSaved(false); }}>{signal === "good" ? "Useful" : signal === "mixed" ? "Close" : "Off target"}</Button>)}</div>
          {feedbackSignal ? <><Textarea value={feedbackNotes} onChange={(event) => setFeedbackNotes(event.target.value)} placeholder="What should change next time?" /><div className="flex items-center gap-3"><Button size="sm" onClick={saveFeedback}>Save feedback</Button>{feedbackSaved ? <span className="text-sm text-ink-muted">Saved.</span> : null}</div></> : null}
        </Card>
      ) : null}
    </div>
  );
}
