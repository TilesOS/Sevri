"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

interface FaqItem {
  question: string;
  answer: string;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl divide-y divide-line">
      {items.map((faq, i) => {
        const open = openIndex === i;
        return (
          <div key={faq.question} className="py-5">
            <button
              type="button"
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 text-left text-lg font-semibold text-ink"
            >
              {faq.question}
              <motion.span
                aria-hidden
                animate={{ rotate: open ? 45 : 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="shrink-0 text-xl leading-none text-teal-deep"
              >
                +
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  key="answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.38, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="pt-3 text-base leading-7 text-ink-soft">{faq.answer}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
