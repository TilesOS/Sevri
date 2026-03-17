import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";

export default function SupportPage() {
  return (
    <div className="py-16">
      <Container className="space-y-6">
        <Card className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-ink-500">Support</p>
            <h1 className="text-3xl font-semibold text-ink-900">Need help?</h1>
          </div>
          <p className="text-ink-700">
            Support details will live here soon. For now, this page reserves a clean public route for onboarding help,
            billing questions, and recommendation troubleshooting.
          </p>
          <p className="text-sm text-ink-500">
            We&apos;ll replace this placeholder with full contact instructions before launch.
          </p>
          <Link href="/" className="text-sm font-medium text-mint-700 hover:text-mint-500">
            Return to home
          </Link>
        </Card>
      </Container>
    </div>
  );
}
