import Link from "next/link";
import { Container } from "@/components/shared/container";

export function MarketingFooter() {
  const footerLinks = [
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms" },
    { href: "/support", label: "Support" },
    { href: "/suggestions", label: "Suggestions" },
  ];

  return (
    <footer className="border-t border-surface-border bg-surface-base/80 text-ink-600">
      <Container className="flex flex-col gap-3 py-6 text-sm md:flex-row md:items-center md:justify-between">
        <p className="text-xs font-semibold tracking-[0.2em] text-ink-500">Sevri</p>
        <div className="flex flex-wrap items-center gap-3 text-sm font-medium">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink-900">
              {link.label}
            </Link>
          ))}
        </div>
      </Container>
    </footer>
  );
}
