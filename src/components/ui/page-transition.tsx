import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: ReactNode;
  transitionKey?: string;
  className?: string;
}

/**
 * The page-enter fade.
 *
 * Deliberately CSS, not a JS animation: the previous version rendered its
 * initial `opacity: 0` into the HTML and relied on JS to animate it back up, so
 * any page where that never ran — error and not-found boundaries especially —
 * stayed almost invisible. The visible state is now the default and the fade is
 * an enhancement on top, which also means reduced-motion users get the content
 * with no delay at all. See `.page-enter` in globals.css.
 */
export function PageTransition({ children, transitionKey, className }: PageTransitionProps) {
  return (
    <div key={transitionKey} className={cn("page-enter", className)}>
      {children}
    </div>
  );
}
