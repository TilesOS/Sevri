"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
export function GenerateRoadmapButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setIsLoading(true);
    setError(null);
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    const response = await fetch("/api/ai/roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, timezone }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string; schedule_ready?: boolean } | null;

    if (!response.ok) {
      setError(body?.error ?? "Failed to generate roadmap");
      setIsLoading(false);
      return;
    }

    if (body?.schedule_ready === false) {
      router.replace(`/project/${projectId}?schedule=retry`);
    } else {
      router.refresh();
    }
    setIsLoading(false);
  }

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="sr-only">
        {error ?? (isLoading ? "Generating roadmap overview." : "")}
      </div>
      <Button onClick={generate} disabled={isLoading}>
        {isLoading ? "Generating roadmap overview..." : "Generate roadmap overview"}
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
