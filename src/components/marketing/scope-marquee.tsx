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
  const numbered = items.map((it, i) => ({ ...it, n: i + 1, grad: GRADIENTS[i % GRADIENTS.length] }));
  const ordered = [...numbered].reverse(); // 1 on the right, 5 on the left
  const loop = [...ordered, ...ordered]; // duplicated for a seamless wrap

  return (
    <div className="relative overflow-hidden">
      <motion.div
        className="flex w-max"
        animate={reduce ? undefined : { x: ["-50%", "0%"] }}
        transition={{ duration: 34, ease: "linear", repeat: Infinity }}
      >
        {loop.map((item, i) => (
          <article
            key={i}
            className="relative mr-6 flex h-64 w-[78vw] shrink-0 flex-col justify-end overflow-hidden rounded-2xl p-7 shadow-[0_24px_60px_rgba(0,0,0,0.55)] ring-1 ring-inset ring-white/[0.07] sm:h-72 sm:w-[360px]"
            style={{ background: item.grad }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/75 via-navy-deep/10 to-transparent" />
            <div className="relative">
              <span className="font-mono text-xs font-semibold text-cream/75">0{item.n}</span>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-cream/60">{item.k}</p>
              <p className="mt-2 text-lg font-medium leading-7 text-cream">{item.v}</p>
            </div>
          </article>
        ))}
      </motion.div>
    </div>
  );
}
