import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";

export default function SuggestionsPage() {
  return (
    <div className="py-16">
      <Container className="space-y-6">
        <Card className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-ink-500">Feedback</p>
            <h1 className="text-3xl font-semibold text-ink-900">Suggestions</h1>
          </div>
          <p className="text-ink-700">
            This page will become Sevri&apos;s public home for feature requests, curriculum feedback, and product ideas.
            For now, it serves as a placeholder route linked from the global footer.
          </p>
          <p className="text-sm text-ink-500">
            We&apos;ll replace this copy with a real intake flow once suggestions are ready to collect.
          </p>
          <Link href="/" className="text-sm font-medium text-mint-700 hover:text-mint-500">
            Return to home
          </Link>
        </Card>
      </Container>
    </div>
  );
}
