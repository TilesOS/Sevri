"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  async function toggleMilestone(milestone: Milestone) {
    setPendingId(milestone.id);

    await fetch(`/api/milestones/${milestone.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !milestone.completed }),
    });

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
    <Card className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Roadmap Steps</h2>
          <p className="text-sm text-ink-600">Open any step to generate detailed guidance only when you need it.</p>
        </div>
      </div>

      <ul className="space-y-4">
        {milestones.map((milestone) => {
          const isExpanded = expandedId === milestone.id;
          const guidance = guidanceById[milestone.id];
          const isGuidancePending = guidancePendingId === milestone.id;
          const guidanceError = guidanceErrorById[milestone.id];

          return (
            <li key={milestone.id} className="rounded-2xl border border-surface-border bg-surface-subtle p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={milestone.completed}
                      onChange={() => toggleMilestone(milestone)}
                      disabled={pendingId === milestone.id}
                    />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">
                        Step {milestone.order_index + 1}
                      </p>
                      <p className="text-lg font-semibold text-ink-900">{milestone.title}</p>
                    </div>
                  </label>

                  <div className="space-y-2 pl-7 text-sm text-ink-700">
                    <p>{milestone.objective ?? milestone.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-ink-600">
                      <span>Deliverable: {milestone.deliverable ?? "Concrete step output"}</span>
                      <span>Time: {milestone.rough_time_estimate ?? "About 1 week"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Button type="button" variant="secondary" onClick={() => toggleExpanded(milestone.id)} disabled={isGuidancePending}>
                    {isExpanded ? "Hide guidance" : isGuidancePending ? "Loading guidance..." : "Open guidance"}
                  </Button>
                  {isExpanded ? (
                    <Button
                      type="button"
                      onClick={() => void fetchGuidance(milestone.id, true)}
                      disabled={isGuidancePending}
                    >
                      {isGuidancePending ? "Refreshing..." : "Refresh guidance"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {guidanceError ? <p className="mt-3 text-sm text-red-500">{guidanceError}</p> : null}

              {isExpanded && guidance ? (
                <div className="mt-5 space-y-4 border-t border-surface-border pt-5">
                  <GuidanceBlock title="What to do now">
                    <p className="text-sm text-ink-700">{guidance.what_to_do_now}</p>
                  </GuidanceBlock>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <GuidanceBlock title="Detailed checklist">
                      <ul className="space-y-2 text-sm text-ink-700">
                        {guidance.checklist.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </GuidanceBlock>

                    <GuidanceBlock title="Deliverables">
                      <ul className="space-y-2 text-sm text-ink-700">
                        {guidance.deliverables.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </GuidanceBlock>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <GuidanceBlock title="Common mistakes">
                      <ul className="space-y-2 text-sm text-ink-700">
                        {guidance.pitfalls.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </GuidanceBlock>

                    <GuidanceBlock title="Tools and resources">
                      <ul className="space-y-2 text-sm text-ink-700">
                        {guidance.tools_resources.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </GuidanceBlock>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <GuidanceBlock title="How to know this step is complete">
                      <ul className="space-y-2 text-sm text-ink-700">
                        {guidance.done_when.map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </GuidanceBlock>

                    <GuidanceBlock title="Coaching note">
                      <p className="text-sm text-ink-700">{guidance.encouragement}</p>
                    </GuidanceBlock>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function GuidanceBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-surface-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">{title}</p>
      {children}
    </div>
  );
}
