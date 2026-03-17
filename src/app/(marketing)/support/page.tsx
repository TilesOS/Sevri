import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

export default function SupportPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <PageHeader
        eyebrow="Support"
        title="Need help with Sevri?"
        description="This route is reserved for onboarding help, billing questions, recommendation troubleshooting, and workspace guidance."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-2xl font-semibold text-ink">What this page will become</h2>
          <p className="mt-4 text-sm leading-7 text-ink-soft">
            A public support surface with contact paths, billing help, and fast answers for the most
            common issues students hit while using the workspace.
          </p>
        </Card>
        <Card tone="blush">
          <h2 className="text-2xl font-semibold text-ink">Current status</h2>
          <p className="mt-4 text-sm leading-7 text-ink-soft">
            This is intentionally minimal for now, but the route is fully designed and ready for real
            support content when it is time to ship.
          </p>
          <div className="mt-6">
            <Button href="/" variant="outline" className="rounded-full">
              Return home
            </Button>
          </div>
        </Card>
      </div>
    </Section>
  );
}
