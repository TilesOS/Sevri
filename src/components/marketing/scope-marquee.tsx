"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";

interface ScopeCard {
  k: string;
  v: string;
}

/**
 * A row of cards that drifts left→right as the section scrolls through the
 * viewport — the horizontal-on-vertical-scroll move from midu.design.
 */
export function ScopeMarquee({ items }: { items: ScopeCard[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const xRaw = useTransform(scrollYProgress, [0, 1], ["-24%", "6%"]);
  const x = useSpring(xRaw, { stiffness: 50, damping: 22, restDelta: 0.001 });

  return (
    <div ref={ref} className="overflow-hidden">
      <motion.div
        style={reduce ? undefined : { x }}
        className="flex gap-5 px-5 will-change-transform sm:px-8"
      >
        {items.map((item, i) => (
          <div
            key={item.k}
            className="flex w-[80vw] shrink-0 flex-col rounded-2xl border border-cream/12 bg-cream/[0.04] p-7 backdrop-blur-sm sm:w-[340px]"
          >
            <span className="font-mono text-xs font-semibold text-teal">0{i + 1}</span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-cream/45">{item.k}</p>
            <p className="mt-3 text-xl font-medium leading-8 text-cream">{item.v}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
