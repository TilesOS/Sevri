import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Project page not found",
  robots: { index: false, follow: false },
};

/**
 * Public project pages have no shared chrome, so this 404 carries its own. It
 * has to stand on its own for a visitor with no Sevri account: say what happened
 * and offer one way forward, without implying the page ever existed.
 */
export default function PublicPortfolioNotFound() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl flex-col">
        <Card padding="lg" className="space-y-6" data-page-enter-skip>
          <PageHeader
            eyebrow="Sevri"
            title="This project page isn't available."
            description="The link may be out of date, or the student may have unpublished it. Public pages can be taken down at any time."
            className="border-b-0 pb-0"
          />
          <div className="flex flex-wrap gap-3">
            <Button href="/" size="lg">
              What is Sevri?
            </Button>
          </div>
        </Card>

        <footer className="mt-auto border-t border-line py-5 text-sm font-semibold text-ink-muted">
          Created with Sevri
        </footer>
      </div>
    </main>
  );
}
