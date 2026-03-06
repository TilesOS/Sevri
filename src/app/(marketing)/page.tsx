import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const steps = [
  {
    title: "1. Profile intake",
    body: "Capture your goals, skills, interests, and time constraints.",
  },
  {
    title: "2. Structured recommendations",
    body: "Get 3 realistic project options with finishability and impressiveness scoring.",
  },
  {
    title: "3. Guided execution",
    body: "Follow milestones, repo structure, and README guidance to ship your project.",
  },
];

export default function HomePage() {
  return (
    <div className="py-16">
      <Container className="space-y-16">
        <section className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <p className="inline-flex rounded-full bg-mint-100 px-3 py-1 text-xs font-semibold text-mint-700">
              Structured project-to-portfolio coach
            </p>
            <h1 className="text-4xl font-bold leading-tight text-ink-900">
              Build one authentic project that actually gets finished.
            </h1>
            <p className="text-lg text-ink-700">
              ProjectForge helps ambitious students scope a realistic software project, execute with clarity, and package
              it for college applications and internships.
            </p>
            <div className="flex items-center gap-3">
              <Link href="/sign-up">
                <Button>Start for free</Button>
              </Link>
              <Link href="/pricing">
                <Button variant="secondary">View pricing</Button>
              </Link>
            </div>
          </div>
          <Card className="space-y-3">
            <h2 className="text-lg font-semibold text-ink-900">What makes this different</h2>
            <ul className="space-y-2 text-sm text-ink-700">
              <li>Authenticity-first project framing (not AI-generated fluff)</li>
              <li>Scope discipline with explicit &quot;cut if behind&quot; guidance</li>
              <li>Portfolio-ready explanation prompts for interviews and apps</li>
            </ul>
          </Card>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-ink-900">How it works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step) => (
              <Card key={step.title}>
                <h3 className="text-lg font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm text-ink-700">{step.body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-ink-900 p-8 text-white">
          <h2 className="text-2xl font-bold">Built for serious students</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-100">
            Ideal for high school and early college builders aiming for college admissions, internships, and standout
            portfolios.
          </p>
          <Link href="/sign-up" className="mt-6 inline-block">
            <Button variant="secondary">Get started now</Button>
          </Link>
        </section>
      </Container>
    </div>
  );
}