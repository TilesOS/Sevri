"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { trackClientEvent } from "@/lib/analytics/events";
import { getPinnedFocusStorageKey } from "@/lib/projects/focus-storage";

interface FocusBlockClientProps {
  projectId: string;
  milestoneId: string;
  stepNumber: number;
  sessionId: string | null;
  initialTask: string;
  hint: string | null;
  triggerContext: string | null;
  durationMinutes: number;
  scheduleTimezone: string;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getLocalSessionStart() {
  const now = new Date();
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    startTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

export function FocusBlockClient({
  projectId,
  milestoneId,
  stepNumber,
  sessionId,
  initialTask,
  hint,
  triggerContext,
  durationMinutes,
  scheduleTimezone,
}: FocusBlockClientProps) {
  const router = useRouter();
  const totalSeconds = durationMinutes * 60;
  const [task, setTask] = useState(initialTask);
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isHintOpen, setIsHintOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const startedEventSentRef = useRef(false);
  const completingRef = useRef(false);

  useEffect(() => {
    const pinned = window.sessionStorage.getItem(getPinnedFocusStorageKey(projectId, milestoneId));
    if (pinned?.trim()) {
      setTask(pinned.trim());
    }
  }, [milestoneId, projectId]);

  useEffect(() => {
    if (!isRunning || remainingSeconds <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearInterval(interval);
  }, [isRunning, remainingSeconds]);

  const completeBlock = useCallback(async () => {
    if (completingRef.current) {
      return;
    }

    completingRef.current = true;
    setIsCompleting(true);
    setIsRunning(false);
    setCompletionError(null);

    const focusedSeconds = Math.max(0, totalSeconds - remainingSeconds);
    const focusedMinutes = Math.max(1, Math.ceil(focusedSeconds / 60));

    try {
      let response: Response;
      if (sessionId) {
        response = await fetch(
          `/api/projects/${projectId}/calendar/work-sessions/${sessionId}/complete`,
          { method: "POST" },
        );
      } else {
        const sessionStart = getLocalSessionStart();
        response = await fetch(`/api/projects/${projectId}/calendar/work-sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            milestoneId,
            date: sessionStart.date,
            startTime: sessionStart.startTime,
            workDescription: task,
            // The existing table enforces a five-minute minimum.
            durationMinutes: Math.max(5, focusedMinutes),
            timezone: scheduleTimezone,
            completedNow: true,
          }),
        });
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not finish this focus block.");
      }

      await trackClientEvent("focus_block_completed", {
        project_id: projectId,
        milestone_id: milestoneId,
        planned: Boolean(sessionId),
        focused_minutes: focusedMinutes,
      }).catch(() => undefined);

      router.push(`/project/${projectId}/steps/${stepNumber}?from=focus#submission-area`);
    } catch (error) {
      completingRef.current = false;
      setIsCompleting(false);
      setCompletionError(error instanceof Error ? error.message : "Could not finish this focus block.");
    }
  }, [milestoneId, projectId, remainingSeconds, router, scheduleTimezone, sessionId, stepNumber, task, totalSeconds]);

  useEffect(() => {
    if (hasStarted && remainingSeconds === 0 && !completingRef.current) {
      void completeBlock();
    }
  }, [completeBlock, hasStarted, remainingSeconds]);

  function toggleTimer() {
    if (!hasStarted) {
      setHasStarted(true);
    }

    if (!startedEventSentRef.current) {
      startedEventSentRef.current = true;
      void trackClientEvent("focus_block_started", {
        project_id: projectId,
        milestone_id: milestoneId,
        planned: Boolean(sessionId),
      }).catch(() => undefined);
    }

    setIsRunning((current) => !current);
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <main className="fixed inset-0 z-[100] overflow-y-auto bg-canvas px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center text-center">
        <div className="w-full space-y-9 rounded-[2rem] border border-line bg-paper px-6 py-10 shadow-lifted sm:px-12 sm:py-14">
          <div className="space-y-4">
            <p className="editorial-kicker">Focus block</p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">{task}</h1>
            {triggerContext ? <p className="text-sm text-ink-muted">Your cue: {triggerContext}</p> : null}
          </div>

          <p className="font-mono text-7xl font-semibold tabular-nums tracking-tight text-ink sm:text-8xl" aria-live="polite">
            {pad(minutes)}:{pad(seconds)}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" size="lg" onClick={toggleTimer} disabled={isCompleting}>
              {isRunning ? "Pause" : hasStarted ? "Resume" : "Start"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => void completeBlock()}
              disabled={!hasStarted || isCompleting}
            >
              {isCompleting ? "Finishing…" : "End block early"}
            </Button>
          </div>

          {hint ? (
            <div className="mx-auto max-w-xl border-t border-line pt-6">
              <button
                type="button"
                className="text-sm font-semibold text-ink-soft hover:text-ink"
                onClick={() => setIsHintOpen((current) => !current)}
                aria-expanded={isHintOpen}
              >
                {isHintOpen ? "Hide hint" : "If you get stuck"}
              </button>
              {isHintOpen ? <p className="mt-3 text-sm leading-6 text-ink-soft">{hint}</p> : null}
            </div>
          ) : null}

          {completionError ? <Alert tone="danger">{completionError}</Alert> : null}
        </div>
      </div>
    </main>
  );
}
