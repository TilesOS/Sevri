import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="border-b border-ink-200 bg-white/90 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-bold text-ink-900">
          ProjectForge
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/pricing" className="text-sm font-medium text-ink-700">
            Pricing
          </Link>
          <Link href="/sign-in" className="text-sm font-medium text-ink-700">
            Sign in
          </Link>
          <Link href="/sign-up">
            <Button className="h-9 px-3" type="button">
              Start free
            </Button>
          </Link>
        </nav>
      </Container>
    </header>
  );
}