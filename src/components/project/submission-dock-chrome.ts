"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Gap left between the last piece of page content and the top of the dock. */
const DOCK_GAP_PX = 24;
/** How far down the page you must be before the dock starts getting out of the way. */
const COLLAPSE_AFTER_PX = 240;
/** Scroll delta that counts as a deliberate direction change rather than jitter. */
const SCROLL_NOISE_PX = 6;

/**
 * Measures the fixed submission dock and reports how much bottom padding the
 * page needs to clear it.
 *
 * A fixed padding value cannot do this job: the dock is one line tall for
 * "Ready when you are" and several for a long evaluation verdict, and at 200%
 * zoom or a short viewport it grew tall enough to cover the page heading.
 */
export function useDockClearance<T extends HTMLElement>() {
  // A callback ref, not a ref object: the dock mounts conditionally, and this
  // way the effect runs exactly when the node appears or goes away.
  const [dockNode, setDockNode] = useState<T | null>(null);
  const [clearance, setClearance] = useState<number | null>(null);

  useEffect(() => {
    if (!dockNode) {
      setClearance(null);
      return;
    }

    const measure = () => setClearance(dockNode.getBoundingClientRect().height + DOCK_GAP_PX);

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(dockNode);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [dockNode]);

  return { dockRef: setDockNode, clearance };
}

/**
 * True when the dock should slide out of the way on a narrow screen: the reader
 * is scrolling down, well past the top of the page, and not mid-submission. Any
 * upward scroll brings it straight back, so the submit action is never more than
 * a flick away.
 */
export function useDockAutoCollapse(disabled: boolean) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastScrollY = useRef(0);
  const expand = useCallback(() => setIsCollapsed(false), []);

  useEffect(() => {
    if (disabled) {
      setIsCollapsed(false);
      return;
    }

    const onScroll = () => {
      const y = window.scrollY;
      const atBottom = window.innerHeight + y >= document.documentElement.scrollHeight - 32;

      if (y < COLLAPSE_AFTER_PX || atBottom) {
        setIsCollapsed(false);
      } else if (y > lastScrollY.current + SCROLL_NOISE_PX) {
        setIsCollapsed(true);
      } else if (y < lastScrollY.current - SCROLL_NOISE_PX) {
        setIsCollapsed(false);
      }

      lastScrollY.current = y;
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [disabled]);

  // `expand` exists so keyboard focus can pull the dock back: a tucked-away bar
  // still holds focusable buttons, and focus must never land off-screen.
  return { isCollapsed, expand };
}
