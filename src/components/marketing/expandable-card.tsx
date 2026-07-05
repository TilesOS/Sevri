"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

interface ExpandableCardProps {
  num: string;
  numColor: string;
  title: string;
  body: string;
  more: string;
}

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

export function ExpandableCard({ num, numColor, title, body, more }: ExpandableCardProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const placeholderBg = `radial-gradient(120% 120% at 28% 24%, ${numColor}, transparent 62%), radial-gradient(120% 120% at 82% 84%, rgba(255,107,76,0.55), transparent 60%), #0B1E4D`;

  return (
    <>
      {/* Trigger tile */}
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        whileHover={{ y: -6 }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="group flex h-full w-full flex-col rounded-2xl bg-paper p-8 text-left shadow-soft transition-shadow duration-200 hover:shadow-lifted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      >
        <span className="font-display text-5xl leading-none" style={{ color: numColor }}>
          {num}
        </span>
        <h3 className="mt-6 text-2xl font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-base leading-7 text-ink-soft">{body}</p>
        <span
          aria-hidden
          className="mt-8 flex h-9 w-9 items-center justify-center self-start rounded-full bg-ink/5 text-ink transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
        >
          <ArrowIcon />
        </span>
      </motion.button>

      {/* Focused modal */}
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute inset-0 cursor-default bg-navy-deep/50 backdrop-blur-md"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.38, ease: EASE }}
              className="relative z-10 grid w-full max-w-4xl overflow-hidden rounded-3xl bg-paper shadow-lifted md:grid-cols-2"
            >
              {/* Image placeholder — left */}
              <div className="relative min-h-[200px] md:min-h-[440px]" style={{ background: placeholderBg }}>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-cream/70">
                  <ImageIcon />
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]">Visual placeholder</span>
                </div>
              </div>

              {/* Text — right */}
              <div className="flex flex-col p-8 sm:p-10">
                <span className="font-display text-5xl leading-none" style={{ color: numColor }}>
                  {num}
                </span>
                <h3 className="mt-4 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
                  {title}
                </h3>
                <div className="my-6 h-px w-full bg-line" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Info</p>
                <p className="mt-3 text-base leading-7 text-ink-soft">
                  {body} {more}
                </p>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink transition hover:bg-ink/10"
              >
                <CloseIcon />
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-4.5-4.5L6 21" />
    </svg>
  );
}
