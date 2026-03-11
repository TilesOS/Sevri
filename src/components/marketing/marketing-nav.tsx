import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";

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
      <Container className="relative flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-serif text-lg font-semibold text-ink-900">
            Sevri
          </Link>
        </div>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-5 text-sm font-medium text-ink-700 md:flex">
          {appLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
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
