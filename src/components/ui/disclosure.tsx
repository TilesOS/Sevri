"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { collapseLabel } from "@/lib/copy/glossary";
import { cn } from "@/lib/utils";

interface DisclosureProps {
  /** Label shown while collapsed, e.g. "Show step detail". */
  title: ReactNode;
  /**
   * Label shown while expanded. Omit it for a plain string title beginning with
   * "Show " or "View " and the collapse label is derived ("Hide step detail").
   */
  openTitle?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

/** "Show step detail" → "Hide step detail" once it is already showing. */
function deriveOpenTitle(title: ReactNode, openTitle?: ReactNode): ReactNode {
  if (openTitle !== undefined) {
    return openTitle;
  }

  return typeof title === "string" ? collapseLabel(title) : title;
}

export function Disclosure({ title, openTitle, children, defaultOpen = false, className }: DisclosureProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const panelId = useId();

  return (
    <details
      ref={detailsRef}
      className={cn("group rounded-xl border border-line bg-paper", className)}
      open={defaultOpen}
      // Reading `open` from the element keeps the label honest whether the toggle
      // came from a click, a keypress, or the browser's own find-in-page.
      onToggle={() => setIsOpen(Boolean(detailsRef.current?.open))}
    >
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-ink marker:hidden [&::-webkit-details-marker]:hidden"
        aria-controls={panelId}
      >
        <span>{isOpen ? deriveOpenTitle(title, openTitle) : title}</span>
        <ChevronDown
          className="h-4 w-4 text-ink-muted transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div id={panelId} className="border-t border-line px-4 py-4 text-sm text-ink-soft">
        {children}
      </div>
    </details>
  );
}
