"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppHeaderClient({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black text-white">
      <Container className="relative flex h-20 items-center justify-between gap-6">
        <Button href="/dashboard" variant="ghost" className="h-auto rounded-full px-0 text-left text-white hover:bg-transparent">
          <span className="flex flex-col">
            <span className="font-display text-2xl leading-none">Sevri</span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
              Your workspace
            </span>
          </span>
        </Button>

        <nav className="hidden items-center gap-2 md:flex">
          {appLinks.map((link) => (
            <Button
              key={link.href}
              href={link.href}
              variant="ghost"
              size="sm"
              className={cn(
                "rounded-full px-4 text-white hover:bg-white/10 hover:text-white",
                pathname.startsWith(link.href) ? "bg-white/12 text-white" : "text-white/72",
              )}
            >
              {link.label}
            </Button>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/72">{displayName}</div>
          <form action="/auth/sign-out" method="post">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-white/15 bg-white/[0.04] text-white hover:border-white/25 hover:bg-white/10"
            >
              Sign out
            </Button>
          </form>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/12 text-white transition hover:bg-white/5 md:hidden"
          aria-label={isOpen ? "Close workspace navigation" : "Open workspace navigation"}
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
              className="absolute inset-x-5 top-[5.5rem] rounded-2xl border border-white/12 bg-black p-5 shadow-soft md:hidden"
            >
              <div className="rounded-xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm text-white/72">
                Signed in as {displayName}
              </div>
              <div className="mt-4 space-y-3">
                {appLinks.map((link) => (
                  <Button
                    key={link.href}
                    href={link.href}
                    variant="ghost"
                    fullWidth
                    className={cn(
                      "justify-start text-white hover:bg-white/10",
                      pathname.startsWith(link.href) && "bg-white/12",
                    )}
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Button>
                ))}
              </div>
              <form action="/auth/sign-out" method="post" className="mt-5 border-t border-white/12 pt-5">
                <Button
                  type="submit"
                  variant="outline"
                  fullWidth
                  className="border-white/15 bg-white/[0.04] text-white hover:border-white/25 hover:bg-white/10"
                >
                  Sign out
                </Button>
              </form>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </Container>
    </header>
  );
}
