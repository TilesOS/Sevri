"use client";

import { useState } from "react";
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

  const ctaHref = isAuthenticated ? "/dashboard" : "/sign-up";
  const ctaLabel = isAuthenticated ? "Open workspace" : "Start free";
  const secondaryHref = isAuthenticated ? "/recommendations" : "/sign-in";
  const secondaryLabel = isAuthenticated ? "Project ideas" : "Sign in";

  return (
    <header className="sticky top-0 z-40 border-b border-contrast-line bg-contrast/95 text-paper backdrop-blur">
      <Container className="relative flex h-20 items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button href="/" variant="ghost" className="h-auto rounded-full px-0 text-left text-paper hover:bg-transparent">
            <span className="flex flex-col">
              <span className="font-display text-2xl leading-none">Sevri</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-paper/60">
                Premium workspace
              </span>
            </span>
          </Button>
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          {publicLinks.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              label={link.label}
              isActive={pathname === link.href}
            />
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Button href={secondaryHref} variant="ghost" size="sm" className="text-paper hover:bg-paper/8">
            {secondaryLabel}
          </Button>
          <Button href={ctaHref} size="sm" className="rounded-full px-5">
            {ctaLabel}
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-contrast-line text-paper md:hidden"
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
              className="absolute inset-x-5 top-[5.5rem] rounded-2xl border border-contrast-line bg-contrast-soft p-5 shadow-lifted md:hidden"
            >
              <div className="space-y-3">
                {publicLinks.map((link) => (
                  <Button
                    key={link.href}
                    href={link.href}
                    variant="ghost"
                    fullWidth
                    className={cn(
                      "justify-start text-paper hover:bg-paper/10",
                      pathname === link.href && "bg-paper/10",
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Button>
                ))}
              </div>
              <div className="mt-5 space-y-3 border-t border-contrast-line pt-5">
                <Button href={secondaryHref} variant="ghost" fullWidth className="text-paper hover:bg-paper/10" onClick={() => setIsOpen(false)}>
                  {secondaryLabel}
                </Button>
                <Button href={ctaHref} fullWidth className="rounded-full" onClick={() => setIsOpen(false)}>
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
      className={cn(
        "rounded-full px-4 text-paper hover:bg-paper/8 hover:text-paper",
        isActive ? "bg-paper/10 text-paper" : "text-paper/72",
      )}
    >
      {label}
    </Button>
  );
}
