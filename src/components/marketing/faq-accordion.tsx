"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

interface FaqItem {
  question: string;
  answer: string;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const baseId = useId();

  return (
    <div className="mx-auto max-w-3xl divide-y divide-line">
      {items.map((faq, i) => {
        const open = openIndex === i;
        const panelId = `${baseId}-panel-${i}`;
        const buttonId = `${baseId}-button-${i}`;

        return (
          <div key={faq.question} className="py-5">
            <button
              type="button"
              id={buttonId}
              onClick={() => setOpenIndex(open ? null : i)}
              aria-expanded={open}
              // Names the region this button governs, so a screen reader can
              // move to the answer instead of hunting for it.
              aria-controls={panelId}
              className="flex w-full items-center justify-between gap-4 text-left text-lg font-semibold text-ink"
            >
              {faq.question}
              <motion.span
                aria-hidden
                animate={{ rotate: open ? 45 : 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="shrink-0 text-xl leading-none text-coral"
              >
                +
              </motion.span>
            </button>

            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  key="answer"
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
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
