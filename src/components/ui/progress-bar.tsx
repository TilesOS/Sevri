"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  helperText?: string;
  className?: string;
}

export function ProgressBar({ value, max = 100, label, helperText, className }: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(value, max));
  const percentage = max === 0 ? 0 : (clampedValue / max) * 100;

  return (
    <div className={cn("space-y-3", className)}>
      {label || helperText ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {label ? <p className="text-sm font-semibold text-ink">{label}</p> : null}
            {helperText ? <p className="text-xs text-ink-muted">{helperText}</p> : null}
          </div>
          <p className="text-sm font-semibold text-ink">{Math.round(percentage)}%</p>
        </div>
      ) : null}
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-strong"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(clampedValue)}
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
