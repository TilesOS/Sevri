"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    // Captured now so the cleanup restores focus to the card that was open, not
    // to whatever the ref happens to hold when the cleanup runs.
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";

    // Focus moves into the dialog. Previously it stayed on the card behind the
    // overlay, so a keyboard or screen-reader user was tabbing through a page
    // they could no longer see.
    //
    // Focused directly rather than inside requestAnimationFrame: the node is
    // already in the DOM by the time this effect runs, and rAF does not fire at
    // all while the document is hidden — focus must not wait on a paint frame.
    panel?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key !== "Tab" || !panel) return;

      // Keep Tab inside the dialog while it owns the screen.
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        panel.focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      // Back to the card that opened it, so the reading position is not lost.
      trigger?.focus();
    };
  }, [close, open]);

  return (
    <>
      {/* Trigger tile */}
      <motion.button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
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
              tabIndex={-1}
              onClick={close}
              className="absolute inset-0 cursor-default bg-navy-deep/50 backdrop-blur-md"
            />

            {/* The dialog semantics and the focus target live on a plain element:
                the animated wrapper is an implementation detail, and focus
                management must not depend on a library forwarding a ref. */}
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={headingId}
              tabIndex={-1}
              className="relative z-10 w-full max-w-xl focus-visible:outline-none"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 14 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: 0.38, ease: EASE }}
                className="overflow-hidden rounded-3xl bg-paper shadow-lifted"
              >
                {/* A single accent rule instead of the old image pane. There is no
                    product screenshot to show here yet, and shipping the words
                    "VISUAL PLACEHOLDER" on the page that explains the product was
                    worse than showing nothing. */}
                <div className="h-1.5 w-full" style={{ background: numColor }} aria-hidden="true" />

                <div className="flex flex-col p-8 pr-14 sm:p-10 sm:pr-16">
                  <span className="font-display text-5xl leading-none" style={{ color: numColor }}>
                    {num}
                  </span>
                  <h3
                    id={headingId}
                    className="mt-4 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl"
                  >
                    {title}
                  </h3>
                  <div className="my-6 h-px w-full bg-line" />
                  <p className="text-base leading-7 text-ink-soft">
                    {body} {more}
                  </p>
                </div>
              </motion.div>

              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="absolute right-4 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-ink/5 text-ink transition hover:bg-ink/10"
              >
                <CloseIcon />
              </button>
            </div>
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
