import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import type { ProjectProgressSummary } from "@/lib/projects/progress";

const stateClassName = {
  complete: "border-teal/60 bg-teal/25 text-navy",
  current: "border-coral bg-coral text-white",
  locked: "border-line-strong bg-surface text-ink-muted",
} as const;

interface ProjectProgressTrackerProps {
  progress: ProjectProgressSummary;
  contrast?: boolean;
  compact?: boolean;
  className?: string;
}

export function ProjectProgressTracker({
  progress,
  contrast = false,
  compact = false,
  className,
}: ProjectProgressTrackerProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <ProgressBar
        value={progress.percent}
        label="Project progress"
        helperText={progress.stageDetail}
        className={contrast ? "[&_.text-ink]:text-paper [&_.text-ink-muted]:text-paper/55" : undefined}
      />

      <div className={cn("grid gap-2", compact ? "grid-cols-5" : "sm:grid-cols-5")}>
        {progress.items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "min-w-0 rounded-md border px-3 py-2",
              contrast ? "border-white/10 bg-white/6" : "bg-canvas",
              item.state === "current" && (contrast ? "border-coral bg-coral/15" : "border-coral/30 bg-coral/[0.06]"),
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn("h-2.5 w-2.5 shrink-0 rounded-full border", stateClassName[item.state])}
                aria-hidden="true"
              />
              <p
                className={cn(
                  "truncate text-xs font-semibold",
                  contrast ? "text-paper" : item.state === "locked" ? "text-ink-muted" : "text-ink",
                )}
                title={item.label}
              >
                {item.label}
              </p>
            </div>
            {!compact ? (
              <p className={cn("mt-1 line-clamp-2 text-xs", contrast ? "text-paper/55" : "text-ink-muted")}>
                {item.detail}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
