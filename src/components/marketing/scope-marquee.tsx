"use client";

import { motion, useReducedMotion } from "motion/react";

interface ScopeCard {
  k: string;
  v: string;
}

// Aurora-like frozen frames — all share the SAME navy base (#0B1E4D, lighter
// than the section's navy-deep) so the cards read as uniform floating panels
// with only the teal/coral blooms varying. CSS gradients, not 10 WebGL contexts.
const BASE = "#0B1E4D";
const GRADIENTS = [
  `radial-gradient(130% 120% at 18% 22%, rgba(70,211,192,0.95), transparent 55%), radial-gradient(120% 120% at 85% 82%, rgba(255,107,76,0.6), transparent 60%), ${BASE}`,
  `radial-gradient(130% 120% at 82% 18%, rgba(91,208,214,0.9), transparent 55%), radial-gradient(120% 120% at 12% 88%, rgba(255,107,76,0.55), transparent 60%), ${BASE}`,
  `radial-gradient(130% 130% at 50% 6%, rgba(255,107,76,0.78), transparent 55%), radial-gradient(120% 120% at 50% 100%, rgba(70,211,192,0.7), transparent 62%), ${BASE}`,
  `radial-gradient(120% 120% at 22% 82%, rgba(91,208,214,0.95), transparent 55%), radial-gradient(120% 120% at 88% 20%, rgba(255,107,76,0.55), transparent 60%), ${BASE}`,
  `radial-gradient(130% 120% at 85% 55%, rgba(70,211,192,0.9), transparent 55%), radial-gradient(120% 120% at 12% 30%, rgba(255,107,76,0.6), transparent 60%), ${BASE}`,
];

export function ScopeMarquee({ items }: { items: ScopeCard[] }) {
  const reduce = useReducedMotion();
  // Cards are numbered by their position in the strip, which is also their
  // reading order. The previous version numbered them before reversing, so the
  // row read 05 → 01 from left to right.
  const ordered = items.map((it, i) => ({ ...it, grad: GRADIENTS[i % GRADIENTS.length] }));
  // The second pass exists only so the scroll can wrap seamlessly. It is the
  // same five cards, so assistive tech is told to ignore it rather than
  // announcing ten value propositions.
  const passes = [
    { key: "primary", hidden: false },
    { key: "clone", hidden: true },
  ] as const;

  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="flex w-max"
        animate={reduce ? undefined : { x: ["-50%", "0%"] }}
        transition={{ duration: 34, ease: "linear", repeat: Infinity }}
      >
        {passes.map((pass) => (
          <div key={pass.key} className="flex" aria-hidden={pass.hidden || undefined}>
            {ordered.map((item, index) => (
              <article
                key={`${pass.key}-${item.k}`}
                className="relative mr-6 flex h-64 w-[78vw] shrink-0 flex-col justify-end overflow-hidden rounded-2xl p-7 ring-1 ring-inset ring-white/[0.08] sm:h-72 sm:w-[360px]"
                style={{ background: item.grad }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/75 via-navy-deep/10 to-transparent" />
                <div className="relative">
                  <span className="font-mono text-xs font-semibold text-cream/75">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-cream/60">{item.k}</p>
                  <p className="mt-2 text-lg font-medium leading-7 text-cream">{item.v}</p>
                </div>
              </article>
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}
