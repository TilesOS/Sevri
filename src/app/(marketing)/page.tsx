import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";

const processSteps = [
  {
    title: "Direction",
    body: "Choose software or research, define the outcome you want, and make Sevri honest about your time budget.",
  },
  {
    title: "Comparison",
    body: "Review three distinct options side by side with scope, difficulty, and why each one fits you.",
  },
  {
    title: "Execution",
    body: "Turn the strongest option into a roadmap, keep milestones moving, and avoid the traps that stall students.",
  },
];

const outcomes = [
  {
    label: "3 compared directions",
    value: "3",
    detail: "Concrete options that feel distinct, believable, and presentation-ready.",
  },
  {
    label: "1 finishable roadmap",
    value: "1",
    detail: "A scoped execution path once you choose the idea worth committing to.",
  },
  {
    label: "4-step intake",
    value: "4",
    detail: "Enough structure to get useful guidance without dumping your whole life story.",
  },
];

const faqs = [
  {
    question: "Is Sevri just another idea generator?",
    answer:
      "No. The point is not novelty for its own sake. Sevri compares options based on finishability, fit, and whether the final work will actually say something about you.",
  },
  {
    question: "Who is this built for?",
    answer:
      "Ambitious high school and early college students who want serious software or research work, but need help choosing a scope they can truly complete.",
  },
  {
    question: "Do I need to know exactly what I want to build already?",
    answer:
      "Not at all. The onboarding flow is designed to translate interests, available time, and goals into directions that are more concrete than a vague topic area.",
  },
];

export default function HomePage() {
  return (
    <>
      <Section tone="contrast" className="overflow-hidden py-14 sm:py-20 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <Reveal className="space-y-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">
                Project-to-portfolio coaching
              </p>
              <h1 className="font-display text-5xl leading-[0.92] text-paper sm:text-6xl lg:text-7xl">
                Build an authentic
                project that actually
                gets finished.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-paper/72">
                Sevri helps driven students create software and research
                projects that speak louder than any bullet point
                on a college app, resume, or portfolio.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button href="/sign-up" size="lg" className="rounded-full px-7">
                Start for free
              </Button>
              <Button
                href="/pricing"
                size="lg"
                variant="outline"
                className="rounded-full border-contrast-line bg-paper/6 text-paper hover:bg-paper/12"
              >
                See pricing
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card tone="contrast" className="border-contrast-line bg-paper/5">
                <p className="editorial-kicker text-paper/55">Tracks</p>
                <p className="mt-3 text-3xl font-semibold text-paper">2</p>
                <p className="mt-2 text-sm leading-6 text-paper/72">
                  Software builds and research projects, each with a tailored intake.
                </p>
              </Card>
              <Card tone="contrast" className="border-contrast-line bg-paper/5">
                <p className="editorial-kicker text-paper/55">Recommendation board</p>
                <p className="mt-3 text-3xl font-semibold text-paper">3</p>
                <p className="mt-2 text-sm leading-6 text-paper/72">
                  Distinct directions you can compare before you commit.
                </p>
              </Card>
              <Card tone="contrast" className="border-contrast-line bg-paper/5">
                <p className="editorial-kicker text-paper/55">Execution bias</p>
                <p className="mt-3 text-3xl font-semibold text-paper">1</p>
                <p className="mt-2 text-sm leading-6 text-paper/72">
                  A single next move at a time, instead of abstract motivation.
                </p>
              </Card>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative mx-auto max-w-xl">
              <div className="space-y-4">
                <Card tone="default" className="rotate-[-3deg] lg:translate-x-6">
                  <p className="editorial-kicker">Software preview</p>
                  <h2 className="mt-3 text-2xl font-semibold text-ink">
                    Neighborhood transit planner
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-ink-soft">
                    Target user: students commuting between class, work, and extracurriculars who need
                    a clearer weekly transit plan.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
                    <span className="rounded-full bg-primary px-3 py-1 text-ink">Balanced pick</span>
                    <span className="rounded-full bg-surface px-3 py-1">8 weeks</span>
                  </div>
                </Card>

                <Card tone="blush" className="lg:-translate-x-6">
                  <p className="editorial-kicker">Research preview</p>
                  <h2 className="mt-3 text-2xl font-semibold text-ink">
                    What keeps students engaged in peer tutoring?
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-ink-soft">
                    Compare survey design, evidence plan, and methodology before you commit to a
                    question that is too broad to finish.
                  </p>
                </Card>

                <Card tone="contrast" className="border-contrast-line">
                  <p className="editorial-kicker text-paper/55">Workspace outcome</p>
                  <div className="mt-3 space-y-3">
                    <div className="flex items-center justify-between text-sm text-paper/72">
                      <span>Roadmap clarity</span>
                      <span className="font-semibold text-paper">High</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-paper/72">
                      <span>Scope discipline</span>
                      <span className="font-semibold text-paper">Visible</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-paper/72">
                      <span>Portfolio signal</span>
                      <span className="font-semibold text-paper">Concrete</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section
        eyebrow="What you leave with"
        title="A sharper direction, not just more ideas."
        description="Sevri is built to create momentum. The output should feel like the beginning of a real project, not the end of a brainstorming session."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {outcomes.map((outcome, index) => (
            <Reveal key={outcome.label} delay={index * 0.08}>
              <StatCard
                label={outcome.label}
                value={outcome.value}
                detail={outcome.detail}
                className="h-full"
              />
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="How it works"
        title="A clean path from uncertainty to execution."
        description="The experience stays intentionally narrow: choose a track, compare strong options, then keep moving through a roadmap with better pacing and clearer tradeoffs."
        className="bg-primary-soft"
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {processSteps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.08}>
              <Card className="h-full">
                <p className="editorial-kicker">Step {index + 1}</p>
                <h3 className="mt-4 text-2xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-ink-soft">{step.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Two tracks"
        title="Choose the kind of proof you want to create."
        description="Both tracks lead to serious work. The difference is whether you want to ship a product experience or build a credible research argument."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <Card className="h-full">
              <p className="editorial-kicker">Software</p>
              <h3 className="mt-4 text-3xl font-semibold text-ink">
                Build something another person can actually use.
              </h3>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-ink-soft">
                <li>Target-user framing, problem definition, and core workflow.</li>
                <li>Roadmaps that keep your first version finishable instead of overbuilt.</li>
                <li>Stronger stories for portfolios, demos, and interviews.</li>
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="h-full">
              <p className="editorial-kicker">Research</p>
              <h3 className="mt-4 text-3xl font-semibold text-ink">
                Turn curiosity into a question with a believable method.
              </h3>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-ink-soft">
                <li>Research questions shaped around evidence you can realistically gather.</li>
                <li>Methodology and deliverable planning that respects your time and access.</li>
                <li>Clearer foundations for papers, posters, and competition submissions.</li>
              </ul>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section
        tone="contrast"
        eyebrow="Scope discipline"
        title="Ambitious doesn’t have to mean impossible."
        description="The best student projects feel slightly above your comfort zone, not wildly above your life. Sevri keeps that tension visible so you can finish with quality instead of drifting into an unfinished mess."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Reveal>
            <Card tone="contrast" className="h-full border-contrast-line bg-paper/5">
              <p className="editorial-kicker text-paper/55">Comparison board</p>
              <p className="mt-3 text-xl font-semibold text-paper">
                Quickest to ship, most ambitious, and balanced pick ribbons help you choose deliberately.
              </p>
            </Card>
          </Reveal>
          <Reveal delay={0.08}>
            <Card tone="contrast" className="h-full border-contrast-line bg-paper/5">
              <p className="editorial-kicker text-paper/55">Workspace coaching</p>
              <p className="mt-3 text-xl font-semibold text-paper">
                Milestones, deliverables, and pitfalls stay visible so you know what to protect and what to cut.
              </p>
            </Card>
          </Reveal>
          <Reveal delay={0.16}>
            <Card tone="contrast" className="h-full border-contrast-line bg-paper/5">
              <p className="editorial-kicker text-paper/55">Value proof</p>
              <p className="mt-3 text-xl font-semibold text-paper">
                The finished work should say something specific about your judgment, not just your effort.
              </p>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section
        eyebrow="FAQ"
        title="Questions ambitious students usually ask first."
        description="If you’re trying to build work that survives real scrutiny, these are the practical questions that tend to matter."
      >
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Reveal key={faq.question} delay={index * 0.06}>
                <Card>
                  <h3 className="text-xl font-semibold text-ink">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-6 text-ink-soft">{faq.answer}</p>
                </Card>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.12}>
            <Card tone="blush" className="h-full">
              <p className="editorial-kicker">Final call</p>
              <h3 className="mt-4 font-display text-4xl leading-none text-ink">
                Start with a direction you can actually carry.
              </h3>
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                Use the free tier to run onboarding, compare your first recommendation board, and decide
                whether Sevri should become your working space for the semester.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href="/sign-up" className="rounded-full px-6">
                  Create free account
                </Button>
                <Button href="/pricing" variant="outline" className="rounded-full">
                  Compare plans
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
