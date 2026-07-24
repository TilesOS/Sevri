import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
}

export function DescriptionList({ items, className }: { items: DescriptionItem[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {items.map((item, index) => (
        <div key={index} className="grid gap-1 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-xs font-medium text-ink-muted">{item.label}</dt>
          <dd className="text-sm leading-6 text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
