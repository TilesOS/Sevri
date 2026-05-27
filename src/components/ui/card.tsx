import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardTone = "default" | "subtle" | "blush" | "primary" | "butter" | "contrast";
type CardPadding = "none" | "sm" | "md" | "lg";
type CardElevation = "none" | "soft" | "lifted";

const toneClassName: Record<CardTone, string> = {
  default: "border-2 border-ink bg-paper text-ink",
  subtle: "border-2 border-line bg-surface/70 text-ink",
  blush: "border-2 border-primary-line bg-primary-soft text-ink",
  primary: "border-2 border-primary-line bg-primary-soft text-ink",
  butter: "border-2 border-primary-line bg-primary-soft text-ink",
  contrast: "contrast-grid border-2 border-contrast-line bg-contrast text-paper",
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
        "rounded-md",
        toneClassName[tone],
        paddingClassName[padding],
        elevationClassName[elevation],
        className,
      )}
      {...props}
    />
  );
}
