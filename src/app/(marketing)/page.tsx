import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "1. Choose your track",
    body: "Pick Software Project or Research Project, then complete a tailored intake.",
  },
  {
    title: "2. Structured recommendations",
    body: "Get 3 realistic options with finishability and impressiveness scoring.",
  },
  {
    title: "3. Guided execution",
    body: "Follow milestones and positioning guidance to ship work you can confidently present.",
  },
];

export default function HomePage() {
  return (
    <div className="py-20">
      <Container className="space-y-24">
        <section className="mx-auto max-w-3xl space-y-8 text-center">
          <p className="inline-flex rounded-full bg-mint-100 px-3 py-1 text-xs font-medium text-mint-700">
            Structured project-to-portfolio coach
          </p>
          <h1 className="text-5xl font-medium leading-tight text-ink-900">
            Build an authentic project path that actually gets finished.
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-ink-700">
            Sevri helps driven students create software and research projects that speak louder than
            any bullet point on a college app, resume, or portfolio.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button className="h-11 px-6 text-base">Start for free</Button>
            </Link>
            <Link href="/pricing">
              <Button variant="secondary" className="h-11 px-6 text-base">View pricing</Button>
            </Link>
          </div>
        </section>

        <div className="space-y-[50px]">
          <section className="space-y-6">
            <h2 className="text-center text-2xl font-medium text-ink-900">How it works</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {steps.map((step) => (
                <Card key={step.title}>
                  <h3 className="text-lg font-semibold text-ink-900">{step.title}</h3>
                  <p className="mt-2 text-sm text-ink-700">{step.body}</p>
                </Card>
              ))}
            </div>
          </section>

          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900">What makes this different</h2>
            <ul className="space-y-2 text-sm text-ink-700">
              <li>Track-specific guidance for software builds and research execution</li>
              <li>Scope discipline with explicit &quot;cut if behind&quot; guidance</li>
              <li>Portfolio-ready explanation prompts for interviews and applications</li>
            </ul>
          </Card>

          <Card className="rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-medium text-ink-900">Built for students who build, not brag</h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-700">
              Ideal for high school and early college students aiming for ambitious outcomes with realistic execution.
            </p>
            <Link href="/sign-up" className="mt-6 inline-block">
              <Button className="h-11 px-6">Get started now</Button>
            </Link>
          </Card>
        </div>
      </Container>
    </div>
  );
}
