import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/onboarding", label: "Onboarding" },
  { href: "/recommendations", label: "Recommendations" },
  { href: "/billing", label: "Billing" },
  { href: "/settings", label: "Settings" },
] as const;

export function MarketingNav() {
  return (
    <header className="border-b border-surface-border bg-surface-base/80 backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif text-lg font-semibold text-ink-900">
            Sevri
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-5 text-sm font-medium text-ink-700 md:flex">
            {appLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>

          <Link href="/sign-in" className="text-sm font-medium text-ink-700">
            Sign in
          </Link>
          <Link href="/sign-up">
            <Button className="h-9 px-3" type="button">
              Start free
            </Button>
          </Link>
        </div>
      </Container>
    </header>
  );
}
