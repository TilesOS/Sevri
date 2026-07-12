import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface DisclosureProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function Disclosure({ title, children, defaultOpen = false, className }: DisclosureProps) {
  return (
    <details className={cn("group rounded-xl border border-line bg-paper", className)} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink marker:hidden">
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 text-ink-muted transition-transform duration-150 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-line px-4 py-4 text-sm text-ink-soft">{children}</div>
    </details>
  );
}
