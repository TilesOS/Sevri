import type { Metadata } from "next";
import { NotFoundState } from "@/components/shared/not-found-state";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function MarketingNotFound() {
  return (
    <Section className="pt-14 sm:pt-20">
      <div className="mx-auto max-w-2xl">
        <NotFoundState
          eyebrow="404"
          title="That page isn't here."
          description="The link may be out of date, or the page may have moved. Here's the way back."
          actions={[
            { href: "/", label: "Go to the homepage" },
            { href: "/pricing", label: "See pricing", variant: "outline" },
          ]}
        />
      </div>
    </Section>
  );
}
