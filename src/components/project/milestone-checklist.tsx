"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StepGuidance } from "@/types/domain";

interface Milestone {
  id: string;
  order_index: number;
  title: string;
  description: string;
  objective?: string | null;
  deliverable?: string | null;
  rough_time_estimate?: string | null;
  completed: boolean;
}

export function MilestoneChecklist({ milestones }: { milestones: Milestone[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [guidanceById, setGuidanceById] = useState<Record<string, StepGuidance>>({});
  const [guidancePendingId, setGuidancePendingId] = useState<string | null>(null);
  const [guidanceErrorById, setGuidanceErrorById] = useState<Record<string, string>>({});
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function toggleMilestone(milestone: Milestone) {
    setPendingId(milestone.id);
    setToggleError(null);

    const response = await fetch(`/api/milestones/${milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !milestone.completed }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setToggleError(body?.error ?? "Failed to update milestone.");
      setPendingId(null);
      return;
    }

    setPendingId(null);
    router.refresh();
  }

  async function fetchGuidance(milestoneId: string, refresh = false) {
    setGuidancePendingId(milestoneId);
    setGuidanceErrorById((current) => ({ ...current, [milestoneId]: "" }));

    const response = await fetch(`/api/ai/milestones/${milestoneId}/guidance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });

    const body = (await response.json().catch(() => null)) as { guidance?: StepGuidance; error?: string } | null;

    if (!response.ok || !body?.guidance) {
      setGuidanceErrorById((current) => ({
        ...current,
        [milestoneId]: body?.error ?? "Failed to load step guidance.",
      }));
      setGuidancePendingId(null);
      return;
    }

    setGuidanceById((current) => ({ ...current, [milestoneId]: body.guidance! }));
    setExpandedId(milestoneId);
    setGuidancePendingId(null);
  }

  function toggleExpanded(milestoneId: string) {
    if (expandedId === milestoneId) {
      setExpandedId(null);
      return;
    }

    if (guidanceById[milestoneId]) {
      setExpandedId(milestoneId);
      return;
    }

    void fetchGuidance(milestoneId);
  }

  return (
    <Card className="space-y-5">
      <div aria-live="polite" className="sr-only">
        {toggleError ??
          Object.values(guidanceErrorById).find(Boolean) ??
          (guidancePendingId ? "Loading milestone guidance." : pendingId ? "Updating milestone." : "")}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-ink">Milestones</h2>
          <p className="text-sm leading-6 text-ink-soft">
            Open any milestone when you need premium guidance. Deliverables and pitfalls stay visible so scope drift feels obvious.
          </p>
        </div>
      </div>

      {toggleError ? <Alert tone="danger">{toggleError}</Alert> : null}

      <ul className="space-y-4">
        {milestones.map((milestone) => {
          const isExpanded = expandedId === milestone.id;
          const guidance = guidanceById[milestone.id];
          const isGuidancePending = guidancePendingId === milestone.id;
          const guidanceError = guidanceErrorById[milestone.id];

          return (
            <li key={milestone.id}>
              <Card className="space-y-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 rounded border-line accent-primary"
                        checked={milestone.completed}
                        onChange={() => toggleMilestone(milestone)}
                        disabled={pendingId === milestone.id}
                      />
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={milestone.completed ? "success" : "neutral"}>
                            Step {milestone.order_index + 1}
                          </Badge>
                          <Badge tone="warning">{milestone.rough_time_estimate ?? "About 1 week"}</Badge>
                        </div>
                        <p className="text-xl font-semibold text-ink">{milestone.title}</p>
                      </div>
                    </label>

                    <div className="space-y-3 pl-8 text-sm text-ink-soft">
                      <p>{milestone.objective ?? milestone.description}</p>
                      <div className="rounded-xl border border-line bg-surface/40 p-4">
                        <p className="editorial-kicker">Deliverable</p>
                        <p className="mt-2 text-sm font-semibold text-ink">{milestone.deliverable ?? "Concrete step output"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => toggleExpanded(milestone.id)}
                      disabled={isGuidancePending}
                      className="rounded-full"
                    >
                      {isExpanded ? "Hide guidance" : isGuidancePending ? "Loading..." : "Open guidance"}
                    </Button>
                    {isExpanded ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void fetchGuidance(milestone.id, true)}
                        disabled={isGuidancePending}
                        className="rounded-full"
                      >
                        {isGuidancePending ? "Refreshing..." : "Refresh guidance"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {guidanceError ? <Alert tone="danger">{guidanceError}</Alert> : null}

                <AnimatePresence initial={false}>
                  {isExpanded && guidance ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 border-t border-line pt-5">
                        <Card tone="subtle">
                          <p className="editorial-kicker">What to do now</p>
                          <p className="mt-3 text-sm leading-6 text-ink-soft">{guidance.what_to_do_now}</p>
                        </Card>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <GuidanceBlock title="Detailed checklist" tone="default">
                            <GuidanceList items={guidance.checklist} />
                          </GuidanceBlock>

                          <GuidanceBlock title="Deliverables" tone="butter">
                            <GuidanceList items={guidance.deliverables} />
                          </GuidanceBlock>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <GuidanceBlock title="Common pitfalls" tone="blush">
                            <GuidanceList items={guidance.pitfalls} />
                          </GuidanceBlock>

                          <GuidanceBlock title="Tools and resources" tone="default">
                            <GuidanceList items={guidance.tools_resources} />
                          </GuidanceBlock>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <GuidanceBlock title="Done when" tone="default">
                            <GuidanceList items={guidance.done_when} />
                          </GuidanceBlock>

                          <GuidanceBlock title="Coaching note" tone="contrast">
                            <p className="text-sm leading-6 text-paper/72">{guidance.encouragement}</p>
                          </GuidanceBlock>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </Card>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function GuidanceBlock({
  title,
  tone = "default",
  children,
}: {
  title: string;
  tone?: "default" | "subtle" | "blush" | "butter" | "contrast";
  children: ReactNode;
}) {
  return (
    <Card tone={tone} className="space-y-2" padding="md">
      <p className={cn("editorial-kicker", tone === "contrast" && "text-paper/55")}>{title}</p>
      {children}
    </Card>
  );
}

function GuidanceList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 text-sm leading-6 text-ink-soft">
      {items.map((item) => (
        <li key={item}>- {item}</li>
      ))}
    </ul>
  );
}
