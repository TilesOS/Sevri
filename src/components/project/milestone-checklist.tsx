"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";

interface Milestone {
  id: string;
  order_index: number;
  title: string;
  description: string;
  completed: boolean;
}

export function MilestoneChecklist({ milestones }: { milestones: Milestone[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

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

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-ink-900">Milestones</h2>
      <ul className="space-y-3">
        {milestones.map((milestone) => (
          <li key={milestone.id} className="rounded-lg border border-ink-200 p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={milestone.completed}
                onChange={() => toggleMilestone(milestone)}
                disabled={pendingId === milestone.id}
              />
              <div>
                <p className="font-medium text-ink-900">
                  {milestone.order_index + 1}. {milestone.title}
                </p>
                <p className="text-sm text-ink-600">{milestone.description}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}