import { PLAN_LIMITS } from "@/lib/usage/limits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

const freeGenerationLimit = PLAN_LIMITS.free.generation_limit;

const processSteps = [
  {
    title: "Direction",
    body: "Tell Sevri what you're drawn to, what you want to get out of it, and how much time you actually have.",
    color: "var(--yellow)",
    num: "01",
  },
  {
    title: "Comparison",
    body: "See three options laid out side by side — what each one requires, how hard it is, and why it might be right for you.",
    color: "var(--cyan)",
    num: "02",
  },
  {
    title: "Execution",
    body: "Turn the option you pick into a roadmap. Move through milestones. Dodge the scope creep that kills most student projects.",
    color: "var(--pink)",
    num: "03",
  },
];

const outcomes = [
  {
    label: "3 compared directions",
    value: "3",
    detail: "Three actually different options to choose from - each an impressive path to showcase your interests.",
    color: "var(--yellow)",
  },
  {
    label: "1 finishable roadmap",
    value: "1",
    detail: "A real roadmap once you've picked your direction. Scoped to what you can actually do.",
    color: "var(--cyan)",
  },
  {
    label: "4-step intake",
    value: "4",
    detail: "Enough structure to get useful guidance without dumping your whole life story.",
    color: "var(--pink)",
  },
];

const faqs = [
  {
    question: "Is Sevri just another idea generator?",
    answer:
      "No. The goal isn't to find something no one has done before. It's to find the right fit for you — something you can finish and actually feel proud of.",
  },
  {
    question: "Who is this built for?",
    answer:
      "Students ages 13 and older, especially high school and early college students, who want to build something real but aren't sure where to start or how to keep the scope from getting away from them.",
  },
  {
    question: "Do I need to know exactly what I want to build already?",
    answer:
      "Not at all. You just need to know what you're interested in and roughly how much time you have. Sevri handles the translation from fuzzy interest to concrete direction.",
  },
];

export default function HomePage() {
  return (
    <>
      <Section tone="contrast" className="contrast-grid overflow-hidden py-14 sm:py-20 lg:py-24">
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
                Sevri helps you pick the right project, scope it to
                something you can finish, and end up with work
                that&apos;s genuinely yours.
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

            {/* Hero stat tiles — solid accent fills on dark bg, like prototype stat-tiles */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div style={{ background: 'var(--cyan)', border: '2px solid var(--ink)', borderRadius: 8, padding: '20px', boxShadow: '4px 4px 0 var(--ink)' }}>
                <p className="editorial-kicker">Tracks</p>
                <p className="mt-3 text-3xl font-semibold text-ink">2</p>
                <p className="mt-2 text-sm leading-6 text-ink">
                  Two paths: software projects and research studies. Each with its own intake.
                </p>
              </div>
              <div style={{ background: 'var(--yellow)', border: '2px solid var(--ink)', borderRadius: 8, padding: '20px', boxShadow: '4px 4px 0 var(--ink)' }}>
                <p className="editorial-kicker">Recommendation board</p>
                <p className="mt-3 text-3xl font-semibold text-ink">3</p>
                <p className="mt-2 text-sm leading-6 text-ink">
                  Three distinct directions, side by side, before you commit to one.
                </p>
              </div>
              <div style={{ background: 'var(--pink)', border: '2px solid var(--ink)', borderRadius: 8, padding: '20px', boxShadow: '4px 4px 0 var(--ink)' }}>
                <p className="editorial-kicker">Execution bias</p>
                <p className="mt-3 text-3xl font-semibold text-ink">1</p>
                <p className="mt-2 text-sm leading-6 text-ink">
                  One clear next step at a time — not a wall of abstract advice.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative mx-auto max-w-xl">
              <div className="space-y-4">
                <Card tone="default" className="rotate-[-3deg] lg:translate-x-6" style={{ borderTop: '4px solid var(--yellow)' }}>
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

                <Card tone="default" className="lg:-translate-x-6" style={{ background: 'var(--cyan)', borderColor: 'var(--ink)', boxShadow: '4px 4px 0 var(--ink)' }}>
                  <p className="editorial-kicker">Research preview</p>
                  <h2 className="mt-3 text-2xl font-semibold text-ink">
                    What keeps students engaged in peer tutoring?
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-ink">
                    Compare survey design, evidence plan, and methodology before you commit to a
                    question that is too broad to finish.
                  </p>
                </Card>

                <Card tone="contrast" className="border-contrast-line" style={{ boxShadow: '4px 4px 0 var(--cyan)' }}>
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
        description="When you're done, you should feel like you're starting something — not like you just finished thinking about it."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {outcomes.map((outcome, index) => (
            <Reveal key={outcome.label} delay={index * 0.08}>
              <div style={{ background: outcome.color, border: '2px solid var(--ink)', borderRadius: 8, padding: '24px', boxShadow: '5px 5px 0 var(--ink)', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <p className="editorial-kicker">{outcome.label}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0 }}>{outcome.value}</p>
                <p className="text-sm leading-6 text-ink">{outcome.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="How it works"
        title="Three steps. No detours."
        description="Pick a track, compare three real options, and start moving. Sevri doesn't ask you to have it figured out before you begin."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {processSteps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.08}>
              <Card className="h-full" style={{ borderTop: `4px solid ${step.color}` }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 56, lineHeight: 0.85, letterSpacing: '-0.04em', color: step.color, marginBottom: 12 }}>{step.num}</p>
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
        title="Two tracks. One for builders, one for researchers."
        description="Both lead to finished work you can stand behind. The question is whether you want to ship something or study something."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <Card className="h-full" style={{ borderTop: '4px solid var(--cyan)' }}>
              <p className="editorial-kicker">Software</p>
              <h3 className="mt-4 text-3xl font-semibold text-ink">
                Build something another person can actually use.
              </h3>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-ink-soft">
                <li>Starts with who uses it and why — before you write a line of code.</li>
                <li>Roadmaps sized for a first version, not a startup pitch.</li>
                <li>Work that&apos;s easy to explain and worth showing.</li>
              </ul>
            </Card>
          </Reveal>
          <Reveal delay={0.1}>
            <Card className="h-full" style={{ borderTop: '4px solid var(--yellow)' }}>
              <p className="editorial-kicker">Research</p>
              <h3 className="mt-4 text-3xl font-semibold text-ink">
                Turn curiosity into a question with a believable method.
              </h3>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-ink-soft">
                <li>Questions sized around data you can actually collect.</li>
                <li>A method and timeline that fits your actual situation.</li>
                <li>Something worth submitting — and worth talking about when you do.</li>
              </ul>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section
        tone="contrast"
        eyebrow="Scope discipline"
        title="The project that gets finished is better than the one that doesn't."
        description="Most student projects stall because the scope was wrong from day one. Sevri keeps that pressure visible — so you can push yourself without losing the project entirely."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Reveal>
            <Card tone="contrast" className="h-full border-contrast-line bg-paper/5" style={{ borderTop: '3px solid var(--yellow)' }}>
              <p className="editorial-kicker text-paper/55">Comparison board</p>
              <p className="mt-3 text-xl font-semibold text-paper">
                Quickest to ship, most ambitious, and balanced pick — three ribbons to help you choose with your eyes open.
              </p>
            </Card>
          </Reveal>
          <Reveal delay={0.08}>
            <Card tone="contrast" className="h-full border-contrast-line bg-paper/5" style={{ borderTop: '3px solid var(--cyan)' }}>
              <p className="editorial-kicker text-paper/55">Workspace coaching</p>
              <p className="mt-3 text-xl font-semibold text-paper">
                Milestones, deliverables, and pitfalls stay visible so you know what to protect and what to cut.
              </p>
            </Card>
          </Reveal>
          <Reveal delay={0.16}>
            <Card tone="contrast" className="h-full border-contrast-line bg-paper/5" style={{ borderTop: '3px solid var(--pink)' }}>
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
        title="Common questions."
        description="The ones that come up before people start."
      >
        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <Reveal key={faq.question} delay={index * 0.06}>
                <Card style={{ borderLeft: `3px solid ${['var(--cyan)', 'var(--yellow)', 'var(--pink)'][index]}` }}>
                  <h3 className="text-xl font-semibold text-ink">{faq.question}</h3>
                  <p className="mt-3 text-sm leading-6 text-ink-soft">{faq.answer}</p>
                </Card>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.12}>
            <div style={{ background: 'var(--yellow)', border: '2px solid var(--ink)', borderRadius: 8, padding: '28px', boxShadow: '6px 6px 0 var(--ink)', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <p className="editorial-kicker">Final call</p>
              <h3 className="mt-4 font-display text-4xl leading-none text-ink">
                Start here. See what fits.
              </h3>
              <p className="mt-4 text-sm leading-6 text-ink">
                The free tier gets you through onboarding and up to {freeGenerationLimit} idea boards so you can try both software and research paths.
                Try it — if it clicks, you&apos;ll know.
              </p>
              <div className="mt-8 flex flex-wrap gap-3" style={{ marginTop: 'auto', paddingTop: 32 }}>
                <Button href="/sign-up" className="rounded-full px-6">
                  Create free account
                </Button>
                <Button href="/pricing" variant="outline" className="rounded-full">
                  Compare plans
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>
    </>
  );
}
