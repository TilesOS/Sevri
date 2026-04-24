import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { trackEvent } from "@/lib/analytics/track";
import { getPublicPortfolioPageBySlug } from "@/lib/db/queries/portfolio-public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

async function trackPublicView(ownerUserId: string, slug: string) {
  try {
    await trackEvent(ownerUserId, "portfolio_public_page_viewed", { slug });
  } catch (error) {
    console.error("portfolio_public_page_viewed tracking failed", error);
  }
}

export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPublicPortfolioPageBySlug(slug);
  if (!page) {
    notFound();
  }

  await trackPublicView(page.ownerUserId, page.slug);

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col">
        <Card tone="contrast" className="border-contrast-line">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="contrast">Public Portfolio</Badge>
              <span className="text-sm text-paper/60">{page.displayName}</span>
            </div>
            <div className="space-y-3">
              <h1 className="font-display text-4xl leading-none text-paper sm:text-5xl">
                {page.projectTitle}
              </h1>
              <p className="text-base leading-7 text-paper/72">{page.summary}</p>
            </div>
          </div>
        </Card>

        <section className="space-y-4 py-6">
          {page.reflection ? (
            <Card className="space-y-3">
              <p className="editorial-kicker">Reflection</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">{page.reflection}</p>
            </Card>
          ) : null}

          {page.featuredSubmissionExcerpt ? (
            <Card className="space-y-3">
              <p className="editorial-kicker">Featured work excerpt</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-ink-soft">
                {page.featuredSubmissionExcerpt}
              </p>
            </Card>
          ) : null}
        </section>

        <footer className="mt-auto border-t border-line py-5 text-sm font-semibold text-ink-muted">
          Created with Sevri
        </footer>
      </div>
    </main>
  );
}
