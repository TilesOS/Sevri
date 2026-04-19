import type { ReactNode } from "react";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";

interface ReviewerShellProps {
  children: ReactNode;
  displayName: string | null;
  email: string | null;
}

export function ReviewerShell({ children, displayName, email }: ReviewerShellProps) {
  const primaryLabel = displayName ?? email ?? "Reviewer";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/94 backdrop-blur">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Link href="/reviewer" className="font-display text-2xl leading-none text-ink">
            Sevri
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs uppercase tracking-[0.24em] text-ink-muted sm:inline">
              Reviewer
            </span>
            <div className="hidden text-right text-xs leading-tight sm:block">
              <p className="font-semibold text-ink">{primaryLabel}</p>
              {email && email !== primaryLabel ? (
                <p className="text-ink-muted">{email}</p>
              ) : null}
            </div>
            <form action="/auth/sign-out" method="post">
              <Button type="submit" variant="outline" size="sm" className="rounded-full">
                Sign out
              </Button>
            </form>
          </div>
        </Container>
      </header>

      <main className="flex-1 py-10 sm:py-14">
        <Container>{children}</Container>
      </main>

      <footer className="border-t border-line bg-canvas">
        <Container className="flex flex-wrap items-center justify-between gap-4 py-6 text-xs text-ink-muted">
          <p>Sevri reviewer workspace.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/support" className="hover:text-ink">Support</Link>
          </div>
        </Container>
      </footer>
    </div>
  );
}
