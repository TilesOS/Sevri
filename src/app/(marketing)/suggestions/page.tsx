import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

export default function SuggestionsPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <PageHeader
        eyebrow="Feedback"
        title="Suggestions"
        description="Share product ideas, feature requests, and curriculum feedback with the Sevri team."
      />
      <Card className="max-w-4xl" elevation="soft">
        <div className="space-y-5 text-sm leading-7 text-ink-soft">
          <p>
            This is Sevri&apos;s public home for feedback about onboarding, recommendation quality, roadmap guidance,
            and the broader student project workflow.
          </p>
          <p>
            Send ideas and feedback to{" "}
            <a className="font-medium text-ink underline" href="mailto:suggestions@sevri.co">
              suggestions@sevri.co
            </a>
            .
          </p>
        </div>
        <div className="mt-8">
          <Button href="/" variant="outline">Return home</Button>
        </div>
      </Card>
    </Section>
  );
}
