import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Container } from "@/components/shared/container";
import { MAIN_CONTENT_ID, SkipToContent } from "@/components/shared/skip-to-content";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipToContent />
      <MarketingNav />
      <main id={MAIN_CONTENT_ID} className="flex-1 pb-10 pt-28 sm:pb-16 sm:pt-32">
        <Container className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
          <div className="relative hidden overflow-hidden rounded-3xl bg-navy p-10 text-cream lg:flex">
            <div className="aurora-fallback pointer-events-none absolute inset-0 opacity-45" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_0%,transparent_40%,rgba(5,18,54,0.7)_100%)]" />
            <div className="relative z-10 flex flex-col justify-between">
              <span className="font-serif text-3xl italic text-cream/80">Sevri</span>
              <div className="space-y-5">
                <h2 className="font-display text-4xl leading-tight sm:text-5xl">
                  A project story that feels earned.
                </h2>
                <p className="max-w-md text-lg leading-8 text-cream/70">
                  From first idea to finished evidence — in any field, scoped to something you can actually finish.
                </p>
              </div>
            </div>
          </div>

          <div className="w-full self-center">{children}</div>
        </Container>
      </main>
      <MarketingFooter />
    </div>
  );
}
