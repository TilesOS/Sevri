import type { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MAIN_CONTENT_ID, SkipToContent } from "@/components/shared/skip-to-content";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipToContent />
      <MarketingNav />
      <main id={MAIN_CONTENT_ID} className="flex-1 pt-20">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
