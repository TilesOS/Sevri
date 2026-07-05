"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableCardProps {
  num: string;
  numColor: string;
  title: string;
  body: string;
  more: string;
}

export function ExpandableCard({ num, numColor, title, body, more }: ExpandableCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <motion.button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      whileHover={{ y: -6 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="group flex h-full w-full flex-col rounded-2xl border border-line bg-paper p-8 text-left shadow-soft transition-shadow duration-200 hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      <span className="font-display text-5xl leading-none" style={{ color: numColor }}>
        {num}
      </span>
      <h3 className="mt-6 text-2xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-base leading-7 text-ink-soft">{body}</p>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="more"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pt-3 text-base leading-7 text-ink-soft">{more}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-coral">
        {open ? "Less" : "More"}
        <span className={cn("text-base leading-none transition-transform duration-200", open && "rotate-45")}>+</span>
      </span>
    </motion.button>
  );
}
