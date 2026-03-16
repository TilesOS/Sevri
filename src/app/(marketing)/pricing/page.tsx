import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const freeFeatures = [
  "Onboarding questionnaire",
  "Two recommendation generation batches (3 ideas each)",
  "Limited roadmap detail",
  "Milestone tracking",
];

const proFeatures = [
  "Multiple recommendation refreshes",
  "Full roadmap depth",
  "README/project brief export",
  "Portfolio packaging tools",
];

export default function PricingPage() {
  return (
    <div className="py-16">
      <Container className="space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-medium text-ink-900">Simple pricing for focused builders</h1>
          <p className="text-sm text-ink-600">Start free, upgrade when you want deeper planning and stronger packaging.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="space-y-4">
            <h2 className="text-xl font-semibold">Free $0 / month</h2>
            <p className="text-sm text-ink-600">Get a taste of Sevri&rsquo;s guidance</p>
            <ul className="space-y-2 text-sm text-ink-700">
              {freeFeatures.map((feature) => (
                <li key={feature}>- {feature}</li>
              ))}
            </ul>
            <Link href="/sign-up">
              <Button className="w-full">Start free</Button>
            </Link>
          </Card>

          <Card className="space-y-4 border-mint-500">
            <h2 className="text-xl font-semibold">Pro $10 / month</h2>
            <p className="text-sm text-ink-600">For students who want the best help for their project</p>
            <ul className="space-y-2 text-sm text-ink-700">
              {proFeatures.map((feature) => (
                <li key={feature}>- {feature}</li>
              ))}
            </ul>
            <Link href="/sign-up">
              <Button className="w-full">Get Pro</Button>
            </Link>
          </Card>
        </div>
      </Container>
    </div>
  );
}
