import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "software" | "research" | "success" | "warning" | "danger" | "contrast";

const toneClassName: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink-soft",
  accent: "bg-primary text-paper",
  software: "bg-primary-soft text-primary",
  research: "bg-surface text-ink-soft",
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
