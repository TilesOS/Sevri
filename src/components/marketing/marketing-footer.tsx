import type { ReactNode } from "react";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";

export function MarketingFooter() {
  const footerLinks = [
    { href: "/privacy", label: "Privacy" },
    { href: "/terms", label: "Terms" },
    { href: "/support", label: "Support" },
    { href: "/suggestions", label: "Suggestions" },
  ];

  return (
    <footer className="mt-24 bg-navy text-cream">
      <Container className="grid gap-12 py-16 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          <span className="font-serif text-4xl leading-none">Sevri</span>
          <p className="max-w-md text-lg leading-8 text-cream/70">
            Pick the right project, scope it small, and finish something worth showing.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/sign-up" className="px-6">
              Start free
            </Button>
            <Button href="/pricing" variant="contrast" className="px-6">
              Pricing
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-16 gap-y-8">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/45">Product</p>
            <div className="flex flex-col gap-2.5 text-sm text-cream/70">
              <FooterLink href="/">Overview</FooterLink>
              <FooterLink href="/pricing">Pricing</FooterLink>
              <FooterLink href="/sign-in">Sign in</FooterLink>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/45">Company</p>
            <div className="flex flex-col gap-2.5 text-sm text-cream/70">
              {footerLinks.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </div>
          </div>
        </div>
      </Container>

    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      href={href}
      variant="ghost"
      className="h-auto justify-start px-0 py-0 text-cream/70 hover:bg-transparent hover:text-cream"
    >
      {children}
    </Button>
  );
}
