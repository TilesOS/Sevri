import { PLAN_LIMITS } from "@/lib/usage/limits";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

const comparisonRows = [
  {
    label: "Recommendation generations",
    free: `${PLAN_LIMITS.free.generation_limit} total`,
    pro: "Unlimited",
  },
  {
    label: "Recommendation board",
    free: "Enough to try one software direction and one research direction",
    pro: "Generate fresh boards whenever your thinking evolves",
  },
  {
    label: "Roadmap experience",
    free: "Roadmap, project pages, and step objectives",
    pro: "Everything in Free plus detailed step coaching and evaluation",
  },
  {
    label: "Portfolio packaging",
    free: "Not included",
    pro: "Included",
  },
];

const faqItems = [
  {
    question: "Should I start on the free plan?",
    answer:
      "Yes, if you want to validate the workflow first. The free tier is designed to help you run onboarding, try two generations total, and see whether Sevri fits how you work.",
  },
  {
    question: "Who is Pro for?",
    answer:
      "Pro is for students who want unlimited generations plus detailed per-step coaching and evaluation while they execute.",
  },
  {
    question: "Can I upgrade later?",
    answer:
      "Absolutely. The recommended path is often to start free, commit to a direction, and upgrade once you want more depth around roadmap and packaging support.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Section className="pt-14 sm:pt-20">
        <PageHeader
          eyebrow="Pricing"
          title="Simple pricing for serious students."
          description="Start free while you validate the workflow. Upgrade when you want unlimited generations, deeper coaching, and a stronger finishing environment."
        />
        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <Card className="flex h-full flex-col">
              <p className="editorial-kicker">Free</p>
              <div className="mt-4 flex items-end gap-2">
                <p className="text-5xl font-semibold text-ink">$0</p>
                <p className="pb-1 text-sm text-ink-muted">/ month</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                Best for trying Sevri, running onboarding, and testing one software project plus one research project before you commit.
              </p>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-ink-soft">
                <li>{PLAN_LIMITS.free.generation_limit} generations total</li>
                <li>4-step onboarding wizard</li>
                <li>Roadmap, project pages, and milestone tracking</li>
                <li>Great for deciding whether the workflow fits your process</li>
              </ul>
              <div className="mt-auto pt-8">
                <Button href="/sign-up" fullWidth className="rounded-full">
                  Start free
                </Button>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.08}>
            <Card tone="contrast" className="flex h-full flex-col border-contrast-line">
              <p className="editorial-kicker text-paper/55">Pro</p>
              <div className="mt-4 flex items-end gap-2">
                <p className="text-5xl font-semibold text-paper">$10</p>
                <p className="pb-1 text-sm text-paper/72">/ month</p>
              </div>
              <p className="mt-4 text-sm leading-6 text-paper/72">
                Best for students who already know they want deeper planning support, unlimited iteration,
                and detailed coaching while the project moves.
              </p>
              <ul className="mt-6 space-y-3 text-sm leading-6 text-paper/72">
                <li>Unlimited generations</li>
                <li>Detailed step guidance and work evaluation</li>
                <li>Built for sustained use during execution</li>
                <li>Better fit once you are committed to shipping</li>
              </ul>
              <div className="mt-auto pt-8">
                <Button href="/sign-up" fullWidth className="rounded-full">
                  Create account
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section
        eyebrow="Comparison"
        title="What changes when you upgrade."
        description="The product contract stays the same: Sevri helps you choose, scope, and finish serious work. Pro mainly increases coaching depth and iteration room."
        className="bg-primary-soft"
      >
        <div className="overflow-hidden rounded-2xl border border-line bg-paper shadow-soft">
          <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr] border-b border-line bg-surface/55 px-6 py-4 text-sm font-semibold text-ink">
            <span>Capability</span>
            <span>Free</span>
            <span>Pro</span>
          </div>
          {comparisonRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[1.2fr_0.9fr_0.9fr] gap-4 border-b border-line px-6 py-4 text-sm leading-6 text-ink-soft last:border-b-0"
            >
              <span className="font-semibold text-ink">{row.label}</span>
              <span>{row.free}</span>
              <span>{row.pro}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Who each plan is for"
        title="Choose the plan that matches your stage."
        description="There is no pressure to upgrade early. The better question is whether you are still deciding or already executing."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Reveal>
            <Card className="h-full">
              <h2 className="text-3xl font-semibold text-ink">Free fits best when you are choosing.</h2>
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                Use it when you want enough structure to compare ideas, test the flow, and confirm which track deserves your time.
              </p>
            </Card>
          </Reveal>
          <Reveal delay={0.08}>
            <Card tone="primary" className="h-full">
              <h2 className="text-3xl font-semibold text-ink">Pro fits best when you are committed.</h2>
              <p className="mt-4 text-sm leading-6 text-ink-soft">
                Upgrade when you want unlimited iteration space, richer step coaching, and better finishing support while the project is actively moving.
              </p>
            </Card>
          </Reveal>
        </div>
      </Section>

      <Section
        tone="contrast"
        eyebrow="Upgrade rationale"
        title="Upgrade for depth, not for novelty."
        description="The value of Pro is not more chaos. It is better support while you refine the right direction and carry it through with more confidence."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card tone="contrast" className="border-contrast-line bg-paper/5">
            <p className="editorial-kicker text-paper/55">More iteration</p>
            <p className="mt-3 text-xl font-semibold text-paper">
              Generate fresh recommendation boards whenever your thinking changes.
            </p>
          </Card>
          <Card tone="contrast" className="border-contrast-line bg-paper/5">
            <p className="editorial-kicker text-paper/55">Better depth</p>
            <p className="mt-3 text-xl font-semibold text-paper">
              Unlock detailed step coaching and evaluation without losing the shape of the project.
            </p>
          </Card>
          <Card tone="contrast" className="border-contrast-line bg-paper/5">
            <p className="editorial-kicker text-paper/55">Stronger finish</p>
            <p className="mt-3 text-xl font-semibold text-paper">
              Carry software and research work to a more polished, more presentable place.
            </p>
          </Card>
        </div>
      </Section>

      <Section
        eyebrow="FAQ"
        title="Common pricing questions."
        description="A few fast answers before you decide."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {faqItems.map((faq, index) => (
            <Reveal key={faq.question} delay={index * 0.06}>
              <Card className="h-full">
                <h2 className="text-xl font-semibold text-ink">{faq.question}</h2>
                <p className="mt-3 text-sm leading-6 text-ink-soft">{faq.answer}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>
    </>
  );
}
