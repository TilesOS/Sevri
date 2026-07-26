"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";

interface PortfolioCurationTriggerProps {
  active: boolean;
  curationKey: string;
  projectId?: string;
}

export function PortfolioCurationTrigger({
  active,
  curationKey,
  projectId,
}: PortfolioCurationTriggerProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    let pollCount = 0;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const poll = () => {
      if (cancelled || pollCount >= 30) return;
      pollCount += 1;
      router.refresh();
      pollTimer = setTimeout(poll, 4_000);
    };

    async function startCuration() {
      setError(null);
      try {
        const response = await fetch("/api/portfolio/curation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(projectId ? { project_id: projectId } : {}),
        });
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        if (!response.ok) {
          throw new Error(body?.error);
        }
        if (!cancelled) {
          router.refresh();
          pollTimer = setTimeout(poll, 4_000);
        }
      } catch {
        if (!cancelled) {
          setError(
            "We couldn't finish preparing the Portfolio summary. Check your connection and try again by refreshing this page.",
          );
        }
      }
    }

    void startCuration();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [active, curationKey, projectId, router]);

  if (!active) return null;
  if (error) return <Alert tone="danger">{error}</Alert>;
  return (
    <Alert tone="info">
      Sevri is preparing the first curated summary. The rest of your Portfolio is ready to use.
    </Alert>
  );
}
