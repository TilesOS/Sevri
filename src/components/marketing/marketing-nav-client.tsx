"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Overview" },
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
] as const;

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface MarketingNavClientProps {
  isAuthenticated: boolean;
}

export function MarketingNavClient({ isAuthenticated }: MarketingNavClientProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  const isLanding = pathname === "/";

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > window.innerHeight * 0.72);
      // Hide on scroll-down, reveal on scroll-up — keeps the nav bar-less
      // without letting it collide with headings while reading.
      if (y < 120) setHidden(false);
      else if (y > lastY.current + 4) setHidden(true);
      else if (y < lastY.current - 4) setHidden(false);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the menu takeover is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on route change + Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cream text only floats over the dark landing hero; everywhere else (and while
  // the cream menu is open) it's ink.
  const lightText = isLanding && !scrolled && !open;

  const signInHref = isAuthenticated ? "/dashboard" : "/sign-in";
  const signInLabel = isAuthenticated ? "Workspace" : "Sign in";
  const ctaHref = isAuthenticated ? "/dashboard" : "/sign-up";

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out",
          hidden && !open ? "-translate-y-full" : "translate-y-0",
        )}
      >
        <Container className="flex h-20 items-center justify-between">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className={cn(
              "font-serif text-[2rem] leading-none tracking-tight transition-colors duration-300",
              lightText ? "text-cream" : "text-ink",
            )}
          >
            Sevri
          </Link>

          <div className="flex items-center gap-5 sm:gap-7">
            <Link
              href={signInHref}
              className={cn(
                "text-sm font-medium tracking-tight transition-colors duration-300 hover:opacity-70",
                lightText ? "text-cream" : "text-ink",
              )}
            >
              {signInLabel}
            </Link>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              className={cn(
                "group -mr-1 flex h-10 w-8 items-center justify-center transition-colors duration-300",
                lightText ? "text-cream" : "text-ink",
              )}
            >
              <span className="relative flex h-3.5 w-6 flex-col justify-center">
                <span
                  className={cn(
                    "absolute left-0 h-[1.5px] w-full rounded-full bg-current transition-all duration-300",
                    open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-[3px] group-hover:top-[1px]",
                  )}
                />
                <span
                  className={cn(
                    "absolute left-0 h-[1.5px] w-full rounded-full bg-current transition-all duration-300",
                    open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-[3px] group-hover:bottom-[1px]",
                  )}
                />
              </span>
            </button>
          </div>
        </Container>
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-0 z-40 overflow-hidden bg-canvas/70 backdrop-blur-2xl"
          >
            <div className="aurora-fallback pointer-events-none absolute inset-0 opacity-40" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(251,246,233,0.25),transparent_62%)]" />

            <div className="relative z-10 flex h-full flex-col justify-center">
              <Container>
                <nav className="flex flex-col">
                  {links.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ y: 44, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: 20, opacity: 0 }}
                      transition={{ delay: 0.12 + i * 0.07, duration: 0.55, ease: EASE }}
                    >
                      <Link
                        href={link.href}
                        onClick={() => setOpen(false)}
                        className="group flex items-baseline gap-5 py-1"
                      >
                        <span className="font-mono text-xs font-semibold text-ink-muted transition-colors group-hover:text-coral">
                          0{i + 1}
                        </span>
                        <span className="font-display text-6xl leading-[1.04] tracking-tight text-ink transition-colors duration-200 group-hover:text-coral sm:text-7xl lg:text-8xl">
                          {link.label}
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </nav>
              </Container>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ delay: 0.42, duration: 0.4 }}
              className="absolute inset-x-0 bottom-0 z-10"
            >
              <Container className="flex flex-col items-start justify-between gap-5 border-t border-line py-8 sm:flex-row sm:items-center">
                <p className="font-serif text-xl italic text-ink-soft">Ready when you are.</p>
                <Button href={ctaHref} size="lg" className="px-7" onClick={() => setOpen(false)}>
                  Start free
                </Button>
              </Container>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
