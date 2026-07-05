import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardTone = "default" | "subtle" | "blush" | "primary" | "butter" | "contrast";
type CardPadding = "none" | "sm" | "md" | "lg";
type CardElevation = "none" | "soft" | "lifted";

const toneClassName: Record<CardTone, string> = {
  default: "bg-paper text-ink",
  subtle: "bg-surface text-ink",
  blush: "bg-primary-soft text-ink",
  primary: "bg-primary-soft text-ink",
  butter: "bg-surface-butter text-ink",
  contrast: "border border-contrast-line bg-navy text-cream",
};

const paddingClassName: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

const elevationClassName: Record<CardElevation, string> = {
  none: "",
  soft: "shadow-soft",
  lifted: "shadow-lifted",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  padding?: CardPadding;
  elevation?: CardElevation;
}

export function Card({
  className,
  tone = "default",
  padding = "md",
  elevation = "none",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        toneClassName[tone],
        paddingClassName[padding],
        elevationClassName[elevation],
        className,
      )}
      {...props}
    />
  );
}
