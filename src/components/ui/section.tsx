import type { ReactNode } from "react";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";

type SectionTone = "default" | "contrast" | "blush" | "butter";

const toneClassName: Record<SectionTone, string> = {
  default: "",
  contrast: "bg-contrast text-paper",
  blush: "bg-surface-mint",
  butter: "bg-surface-butter",
};

interface SectionProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  tone?: SectionTone;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
}

export function Section({
  eyebrow,
  title,
  description,
  actions,
  tone = "default",
  className,
  containerClassName,
  children,
}: SectionProps) {
  return (
    <section className={cn("py-16 sm:py-20", toneClassName[tone], className)}>
      <Container className={cn("space-y-10", containerClassName)}>
        {eyebrow || title || description || actions ? (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              {eyebrow ? (
                <p className={cn("editorial-kicker", tone === "contrast" && "text-paper/70")}>{eyebrow}</p>
              ) : null}
              {title ? (
                <h2 className={cn("font-display text-4xl leading-none sm:text-5xl", tone === "contrast" && "text-paper")}>
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className={cn("max-w-2xl text-base leading-7 text-ink-soft", tone === "contrast" && "text-paper/72")}>
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
