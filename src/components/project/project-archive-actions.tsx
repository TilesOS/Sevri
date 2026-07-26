"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toUserFacingError } from "@/lib/errors/user-messages";

interface ProjectArchiveActionsProps {
  projectId: string;
  projectTitle: string;
  archived: boolean;
}

/**
 * Archive hides a project from the dashboard and calendar; nothing is deleted
 * and restoring brings it straight back. Because it is reversible, archiving
 * asks for one inline confirmation rather than a modal.
 */
export function ProjectArchiveActions({ projectId, projectTitle, archived }: ProjectArchiveActionsProps) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(nextArchived: boolean) {
    setIsPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: nextArchived }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(toUserFacingError(body?.error, "We couldn't update that project. Try again in a moment."));
        setIsPending(false);
        return;
      }

      setIsConfirming(false);
      setIsPending(false);
      router.refresh();
    } catch {
      setError("We couldn't reach Sevri. Check your connection and try again.");
      setIsPending(false);
    }
  }

  if (archived) {
    return (
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void submit(false)}
          disabled={isPending}
        >
          {isPending ? "Restoring..." : "Restore"}
        </Button>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    );
  }

  if (isConfirming) {
    return (
      <div className="space-y-2">
        <p className="text-xs leading-5 text-ink-muted">
          Hide &ldquo;{projectTitle}&rdquo; from your dashboard and calendar? Everything stays saved and you can
          restore it any time.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void submit(true)} disabled={isPending}>
            {isPending ? "Archiving..." : "Archive"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsConfirming(false)}
            disabled={isPending}
          >
            Keep it
          </Button>
        </div>
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsConfirming(true)}
        aria-label={`Archive ${projectTitle}`}
      >
        Archive
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
