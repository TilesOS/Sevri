import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: string;
  breadcrumbs?: ReactNode;
  metadata?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, breadcrumbs, metadata, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="max-w-3xl space-y-2.5">
        {breadcrumbs}
        {eyebrow ? (
          <p className="flex items-center gap-2 font-serif text-xl italic text-ink-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" aria-hidden="true" />
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-2.5">
          <h1 className="font-display text-3xl font-semibold leading-[1.08] tracking-tight text-ink sm:text-[2.1rem]">{title}</h1>
          {description ? <p className="max-w-2xl text-[15px] leading-6 text-ink-soft">{description}</p> : null}
          {metadata ? <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">{metadata}</div> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
