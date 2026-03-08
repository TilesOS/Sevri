import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative mx-auto grid min-h-screen max-w-4xl items-center px-6 py-16">
      <div className="absolute left-6 top-6">
        <ThemeToggle />
      </div>
      <div className="space-y-6">
        <Link href="/" className="text-lg font-bold text-ink-900">
          ProjectForge
        </Link>
        {children}
      </div>
    </main>
  );
}
