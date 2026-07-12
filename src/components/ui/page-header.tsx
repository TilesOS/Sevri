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
    <div className={cn("flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="max-w-3xl space-y-2">
        {breadcrumbs}
        {eyebrow ? <p className="text-xs font-medium text-ink-muted">{eyebrow}</p> : null}
        <div className="space-y-2">
          <h1 className="font-sans text-3xl font-semibold leading-tight tracking-tight text-ink">{title}</h1>
          {description ? <p className="max-w-2xl text-sm leading-6 text-ink-soft">{description}</p> : null}
          {metadata ? <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">{metadata}</div> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}
