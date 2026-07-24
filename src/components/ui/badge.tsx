import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "software" | "research" | "success" | "warning" | "danger" | "contrast";

const toneClassName: Record<BadgeTone, string> = {
  neutral: "bg-surface text-ink-soft ring-1 ring-inset ring-line/80",
  accent: "bg-primary-soft text-ink ring-1 ring-inset ring-primary/20",
  software: "bg-teal/10 text-navy ring-1 ring-inset ring-teal/20",
  research: "bg-navy/10 text-navy ring-1 ring-inset ring-navy/15",
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
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        toneClassName[tone],
        className,
      )}
      {...props}
    />
  );
}
