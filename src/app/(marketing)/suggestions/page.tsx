import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";

export default function SuggestionsPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <div style={{ marginBottom: 40 }}>
        <div className="kicker" style={{ marginBottom: 10 }}>
          <span className="star">✦</span>
          <span>FEEDBACK</span>
        </div>
        <h1 className="display" style={{ margin: 0 }}>
          <span className="hl-yellow">Suggestions</span>
          <span style={{ color: 'var(--pink)' }}>.</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 16, maxWidth: 600, lineHeight: 1.6 }}>
          This route is designed to become Sevri&apos;s public home for feature ideas, product feedback, and curriculum suggestions.
        </p>
      </div>
      <Card className="max-w-4xl" style={{ borderTop: '4px solid var(--cyan)' }}>
        <div className="space-y-5 text-sm leading-7 text-ink-soft">
          <p>
            The eventual version of this page will collect requests around onboarding, recommendation
            quality, roadmap guidance, and the broader student project workflow in a more structured fashion.
          </p>
          <p>
            Until then, send ideas and feedback to{" "}
            <a className="font-medium text-ink underline" href="mailto:suggestions@sevri.co">
              suggestions@sevri.co
            </a>
            .
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
