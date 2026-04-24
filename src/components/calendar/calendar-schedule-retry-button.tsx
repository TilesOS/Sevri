"use client";

import { startTransition, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function CalendarScheduleRetryButton({
  projectId,
  className,
  onSuccess,
}: {
  projectId: string;
  className?: string;
  onSuccess?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRetry() {
    setIsPending(true);
    setError(null);

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const response = await fetch(`/api/projects/${projectId}/calendar/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    });

    const body = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setError(body?.error ?? "Failed to regenerate the schedule.");
      setIsPending(false);
      return;
    }

    setIsPending(false);
    onSuccess?.();
    startTransition(() => {
      router.replace(pathname);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className={className}
        onClick={() => void handleRetry()}
        disabled={isPending}
      >
        {isPending ? "Rebuilding..." : "Retry schedule"}
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
