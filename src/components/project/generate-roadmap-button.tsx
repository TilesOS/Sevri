"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ProjectTrack } from "@/types/domain";

export function GenerateRoadmapButton({ projectId, projectTrack = "software" }: { projectId: string; projectTrack?: ProjectTrack }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setIsLoading(true);
    setError(null);

    const response = await fetch("/api/ai/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(body?.error ?? "Failed to generate roadmap");
      setIsLoading(false);
      return;
    }

    router.refresh();
    setIsLoading(false);
  }

  const loadingLabel = projectTrack === "research" ? "Generating roadmap overview..." : "Generating roadmap overview...";
  const idleLabel = projectTrack === "research" ? "Generate roadmap overview" : "Generate roadmap overview";

  return (
    <div className="space-y-3">
      <Button onClick={generate} disabled={isLoading}>
        {isLoading ? loadingLabel : idleLabel}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
