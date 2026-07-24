"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, Plug, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/settings", label: "Profile", icon: UserRound },
  { href: "/settings/integrations", label: "Integrations", icon: Plug },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
] as const;

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-line" aria-label="Settings">
      {links.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm transition-colors",
              active ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
