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
        description="This route is designed to become Sevri's public home for feature ideas, product feedback, and curriculum suggestions."
      />
      <Card className="max-w-4xl">
        <div className="space-y-5 text-sm leading-7 text-ink-soft">
          <p>
            The eventual version of this page will collect requests around onboarding, recommendation
            quality, roadmap guidance, and the broader student project workflow.
          </p>
          <p>
            For now, the important part is that the page feels like part of the product system instead
            of a placeholder. The future intake form can slot into this template cleanly.
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
