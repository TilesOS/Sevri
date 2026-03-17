import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

export default function PrivacyPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        description="Sevri stores only the information needed to power your workspace, recommendation flow, and account management."
      />
      <Card className="max-w-4xl">
        <div className="space-y-5 text-sm leading-7 text-ink-soft">
          <p>
            Your profile details, onboarding responses, and project workspace data are used to generate
            better recommendations and keep your roadmap coherent across sessions.
          </p>
          <p>
            Sevri does not sell personal information or expose private account data without consent.
            You can review or update saved profile details from settings, and this public page will be
            replaced with a full legal draft before launch.
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
