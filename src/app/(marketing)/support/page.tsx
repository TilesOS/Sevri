import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/page-transition";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Support",
  description: "Onboarding help, billing questions, and workspace guidance for Sevri students.",
  openGraph: {
    title: "Support — Sevri",
    description: "Onboarding help, billing questions, and workspace guidance for Sevri students.",
  },
};

export default function SupportPage() {
  return (
    <PageTransition>
      <Section className="pt-10">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-serif text-xl italic text-coral">Support</p>
          <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl">
            Need a hand?
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-8 text-ink-soft">
            Onboarding help, billing questions, and workspace guidance — reach us directly while this page grows.
          </p>
        </div>
        <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2">
          <Card padding="lg" elevation="soft">
            <h2 className="text-2xl font-semibold text-ink">Get in touch</h2>
            <p className="mt-3 text-base leading-7 text-ink-soft">
              Email us and we&apos;ll get back to you.
            </p>
            <div className="mt-6">
              <Button href="mailto:support@sevri.co">support@sevri.co</Button>
            </div>
          </Card>
          <Card padding="lg" elevation="soft" tone="subtle">
            <h2 className="text-2xl font-semibold text-ink">Coming soon</h2>
            <p className="mt-3 text-base leading-7 text-ink-soft">
              Structured help for the most common questions students hit in the workspace.
            </p>
            <div className="mt-6">
              <Button href="/" variant="outline">
                Return home
              </Button>
            </div>
          </Card>
        </div>
      </Section>
    </PageTransition>
  );
}
