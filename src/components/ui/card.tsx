import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardTone = "default" | "subtle" | "blush" | "butter" | "contrast";
type CardPadding = "none" | "sm" | "md" | "lg";
type CardElevation = "none" | "soft" | "lifted";

const toneClassName: Record<CardTone, string> = {
  default: "border-line bg-paper text-ink",
  subtle: "border-line bg-surface/60 text-ink",
  blush: "border-terracotta/20 bg-surface-blush text-ink",
  butter: "border-[#ddc575] bg-surface-butter text-ink",
  contrast: "border-contrast-line bg-contrast text-paper",
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
  elevation = "soft",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border",
        toneClassName[tone],
        paddingClassName[padding],
        elevationClassName[elevation],
        className,
      )}
      {...props}
    />
  );
}
