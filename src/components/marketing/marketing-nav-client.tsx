"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const publicLinks = [
  { href: "/", label: "Overview" },
  { href: "/pricing", label: "Pricing" },
  { href: "/support", label: "Support" },
] as const;

interface MarketingNavClientProps {
  isAuthenticated: boolean;
}

export function MarketingNavClient({ isAuthenticated }: MarketingNavClientProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaHref = isAuthenticated ? "/dashboard" : "/sign-up";
  const ctaLabel = isAuthenticated ? "Open workspace" : "Start free";
  const secondaryHref = isAuthenticated ? "/recommendations" : "/sign-in";
  const secondaryLabel = isAuthenticated ? "Project ideas" : "Sign in";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled
          ? "border-line/70 bg-canvas/80 backdrop-blur-xl"
          : "border-transparent bg-canvas/40 backdrop-blur-md",
      )}
    >
      <Container className="relative flex h-16 items-center justify-between gap-6">
        <Button href="/" variant="ghost" className="h-auto rounded-full px-0 text-left hover:bg-transparent">
          <span className="font-serif text-[2rem] leading-none tracking-tight text-ink">Sevri</span>
        </Button>

        <nav className="hidden items-center gap-1 md:flex">
          {publicLinks.map((link) => (
            <NavLink key={link.href} href={link.href} label={link.label} isActive={pathname === link.href} />
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button href={secondaryHref} variant="ghost" size="sm">
            {secondaryLabel}
          </Button>
          <Button href={ctaHref} size="sm" className="px-5">
            {ctaLabel}
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line text-ink transition hover:bg-surface md:hidden"
          aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
        >
          <div className="flex w-5 flex-col gap-1.5">
            <span className={cn("h-0.5 w-full rounded-full bg-current transition", isOpen && "translate-y-2 rotate-45")} />
            <span className={cn("h-0.5 w-full rounded-full bg-current transition", isOpen && "opacity-0")} />
            <span className={cn("h-0.5 w-full rounded-full bg-current transition", isOpen && "-translate-y-2 -rotate-45")} />
          </div>
        </button>

        <AnimatePresence>
          {isOpen ? (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-5 top-[4.75rem] rounded-2xl border border-line bg-canvas/95 p-5 shadow-lifted backdrop-blur-xl md:hidden"
            >
              <div className="space-y-1">
                {publicLinks.map((link) => (
                  <Button
                    key={link.href}
                    href={link.href}
                    variant="ghost"
                    fullWidth
                    className={cn("justify-start", pathname === link.href && "bg-surface")}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Button>
                ))}
              </div>
              <div className="mt-4 space-y-2 border-t border-line pt-4">
                <Button href={secondaryHref} variant="outline" fullWidth onClick={() => setIsOpen(false)}>
                  {secondaryLabel}
                </Button>
                <Button href={ctaHref} fullWidth onClick={() => setIsOpen(false)}>
                  {ctaLabel}
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Container>
    </header>
  );
}

function NavLink({ href, label, isActive }: { href: string; label: string; isActive: boolean }) {
  return (
    <Button
      href={href}
      variant="ghost"
      size="sm"
      className={cn("rounded-full px-4 text-ink-soft hover:text-ink", isActive && "bg-surface text-ink")}
    >
      {label}
    </Button>
  );
}
