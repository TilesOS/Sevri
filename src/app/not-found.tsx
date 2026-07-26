import type { Metadata } from "next";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { NotFoundState } from "@/components/shared/not-found-state";
import { MAIN_CONTENT_ID, SkipToContent } from "@/components/shared/skip-to-content";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Page not found",
};

/**
 * The catch-all 404 for URLs that match no route at all. It renders in the root
 * layout, so it brings its own nav and footer rather than inheriting a group's.
 */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipToContent />
      <MarketingNav />
      <main id={MAIN_CONTENT_ID} className="flex-1 pt-20">
        <Section className="pt-14 sm:pt-20">
          <div className="mx-auto max-w-2xl">
            <NotFoundState
              eyebrow="404"
              title="That page isn't here."
              description="Check the link for a typo, or start again from the homepage. If you were signed in, your workspace is untouched."
              actions={[
                { href: "/", label: "Go to the homepage" },
                { href: "/dashboard", label: "Open your workspace", variant: "outline" },
              ]}
            />
          </div>
        </Section>
      </main>
      <MarketingFooter />
    </div>
  );
}
