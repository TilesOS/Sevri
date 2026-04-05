import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <main className="flex-1 py-10 sm:py-16">
        <Container className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <Card tone="contrast" className="contrast-grid relative overflow-hidden">
            <div className="absolute inset-x-8 top-8 h-px bg-paper/10" aria-hidden="true" />
            <div className="relative space-y-8 p-8 sm:p-10">
              <Badge tone="accent">Premium workspace</Badge>
              <div className="space-y-4">
                <h1 className="font-display text-4xl leading-none text-paper sm:text-5xl">
                  Build a project story that feels earned.
                </h1>
                <p className="max-w-xl text-base leading-7 text-paper/72">
                  Sevri gives ambitious students a cleaner path from first idea to finished software or research work
                  that can stand up in applications, interviews, and portfolios.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-contrast-line bg-paper/6 p-4">
                  <p className="text-sm font-semibold text-paper">Software path</p>
                  <p className="mt-2 text-sm leading-6 text-paper/72">
                    Pick a target user, define the problem, and ship an experience with a believable scope.
                  </p>
                </div>
                <div className="rounded-xl border border-contrast-line bg-paper/6 p-4">
                  <p className="text-sm font-semibold text-paper">Research path</p>
                  <p className="mt-2 text-sm leading-6 text-paper/72">
                    Translate curiosity into a research question, methodology, and evidence plan you can actually carry out.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <div className="w-full">{children}</div>
        </Container>
      </main>
      <MarketingFooter />
    </div>
  );
}
