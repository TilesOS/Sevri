import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "software" | "research" | "success" | "warning" | "danger" | "contrast";

const toneClassName: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink-soft",
  accent: "bg-secondary-blue text-paper",
  software: "bg-secondary-blue-soft text-secondary-blue",
  research: "bg-secondary-pink-soft text-secondary-pink",
  success: "bg-primary-soft text-ink",
  warning: "bg-surface-butter text-ink-soft",
  danger: "bg-red-100 text-red-700",
  contrast: "bg-white/10 text-white",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        toneClassName[tone],
        className,
      )}
      {...props}
    />
  );
}
