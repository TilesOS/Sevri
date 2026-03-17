import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/shared/container";

export default function PrivacyPage() {
  return (
    <div className="py-16">
      <Container className="space-y-6">
        <Card className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-ink-500">Legal</p>
            <h1 className="text-3xl font-semibold text-ink-900">Privacy Policy</h1>
          </div>
          <p className="text-ink-700">
            Sevri collects only the data necessary to power your project journey and keeps it encrypted at rest. We never
            share personally identifiable information without your explicit consent, and you can always review or delete
            your profile data from the settings page.
          </p>
          <p className="text-sm text-ink-500">
            This placeholder copy summarizes the privacy mindset for now; update it when a full policy is ready to ship.
          </p>
          <Link href="/" className="text-sm font-medium text-mint-700 hover:text-mint-500">
            Return to home
          </Link>
        </Card>
      </Container>
    </div>
  );
}
