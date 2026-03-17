import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

export default function TermsPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        description="These terms will be expanded before launch; this page currently outlines the intent behind the product."
      />
      <Card className="max-w-4xl">
        <div className="space-y-5 text-sm leading-7 text-ink-soft">
          <p>
            Sevri is designed to help students choose, scope, and finish meaningful software or
            research projects. Using the product means agreeing to the workspace rules, plan limits,
            and normal expectations around respectful account use.
          </p>
          <p>
            The experience is provided as a coaching and planning tool. A complete legal draft will
            replace this summary before launch, but the core promise will stay the same: clear
            guidance in exchange for responsible product use.
          </p>
        </div>
        <div className="mt-8">
          <Button href="/" variant="outline" className="rounded-full">
            Return home
          </Button>
        </div>
      </Card>
    </Section>
  );
}
