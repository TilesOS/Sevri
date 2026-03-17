import type { ReactNode } from "react";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";

export function MarketingFooter() {
  const footerLinks = [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms" },
    { href: "/support", label: "Support" },
    { href: "/suggestions", label: "Suggestions" },
  ];

  return (
    <footer className="mt-16 bg-contrast text-paper">
      <Container className="grid gap-10 py-14 lg:grid-cols-[1.4fr_0.8fr] lg:items-start">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="editorial-kicker text-paper/55">Project-to-portfolio coaching</p>
            <h2 className="font-display text-4xl leading-none text-paper sm:text-5xl">
              Finish something worth showing.
            </h2>
            <p className="max-w-2xl text-base leading-7 text-paper/72">
              Sevri helps ambitious students choose the right software or research project, scope it honestly,
              and follow through with work they can actually present with confidence.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button href="/sign-up" className="rounded-full px-6">
              Start free
            </Button>
            <Button
              href="/pricing"
              variant="outline"
              className="rounded-full border-contrast-line bg-paper/6 text-paper hover:bg-paper/12"
            >
              View pricing
            </Button>
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-paper">Explore</p>
            <div className="space-y-2 text-sm text-paper/72">
              <FooterLink href="/">Home</FooterLink>
              <FooterLink href="/pricing">Pricing</FooterLink>
              <FooterLink href="/sign-in">Sign in</FooterLink>
              <FooterLink href="/sign-up">Create account</FooterLink>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-paper">Company</p>
            <div className="space-y-2 text-sm text-paper/72">
              {footerLinks.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </div>
          </div>
        </div>
      </Container>

      <div className="border-t border-contrast-line bg-accent text-accent-ink">
        <Container className="flex flex-col gap-6 py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.28em]">Scope matters. Finishability matters.</p>
          <p className="font-display text-[clamp(3.3rem,9vw,8rem)] leading-[0.88]">Build the thing you can finish.</p>
        </Container>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button href={href} variant="ghost" className="h-auto justify-start px-0 py-0 text-paper/72 hover:bg-transparent hover:text-paper">
      {children}
    </Button>
  );
}
