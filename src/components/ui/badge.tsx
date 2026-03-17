import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "software" | "research" | "success" | "warning" | "danger" | "contrast";

const toneClassName: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink-soft",
  accent: "bg-accent text-accent-ink",
  software: "bg-accent-soft text-ink",
  research: "bg-terracotta-soft text-terracotta",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-surface-butter text-ink",
  danger: "bg-red-100 text-red-700",
  contrast: "bg-paper/10 text-paper",
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
