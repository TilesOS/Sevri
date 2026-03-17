import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/shared/container";

export default function TermsPage() {
  return (
    <div className="py-16">
      <Container className="space-y-6">
        <Card className="space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-ink-500">Legal</p>
            <h1 className="text-3xl font-semibold text-ink-900">Terms of Service</h1>
          </div>
          <p className="text-ink-700">
            Using Sevri means agreeing to our focused project coaching model, staying respectful in collaborations, and
            honoring the usage limits described on the pricing page. The product is provided as-is with the intent of
            helping determined students finish real work.
          </p>
          <p className="text-sm text-ink-500">This is a temporary placeholder until a complete legal draft is available.</p>
          <Link href="/" className="text-sm font-medium text-mint-700 hover:text-mint-500">
            Return to home
          </Link>
        </Card>
      </Container>
    </div>
  );
}
