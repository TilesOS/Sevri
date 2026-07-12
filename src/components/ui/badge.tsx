import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "software" | "research" | "success" | "warning" | "danger" | "contrast";

const toneClassName: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink-soft",
  accent: "bg-navy/8 text-navy ring-1 ring-inset ring-navy/15",
  software: "bg-teal/10 text-teal-deep ring-1 ring-inset ring-teal/20",
  research: "bg-navy/8 text-navy ring-1 ring-inset ring-navy/15",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
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
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        toneClassName[tone],
        className,
      )}
      {...props}
    />
  );
}
