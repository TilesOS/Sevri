import { PLAN_LIMITS } from "@/lib/usage/limits";
import { AuroraBackground } from "@/components/marketing/aurora-background";
import { ExpandableCard } from "@/components/marketing/expandable-card";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { ScopeMarquee } from "@/components/marketing/scope-marquee";
import { HeroScrollFade } from "@/components/marketing/scroll-motion";
import { Container } from "@/components/shared/container";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

const freeGenerationLimit = PLAN_LIMITS.free.generation_limit;

const proof = [
  { label: "2 tracks", color: "var(--teal)" },
  { label: "3 directions compared", color: "var(--coral)" },
  { label: "1 finishable roadmap", color: "var(--pale-blue)" },
];

const steps = [
  {
    num: "01",
    title: "Direction",
    body: "Tell Sevri what you're drawn to and how much time you have.",
    more: "A short intake — no life story. Enough for Sevri to understand your interests, level, and constraints.",
    color: "var(--teal)",
  },
  {
    num: "02",
    title: "Comparison",
    body: "See three real options side by side, then choose with your eyes open.",
    more: "Each option is ranked by effort and ambition, with the trade-offs made explicit before you commit.",
    color: "var(--coral)",
  },
  {
    num: "03",
    title: "Execution",
    body: "Turn your pick into a roadmap and move through it, milestone by milestone.",
    more: "Milestones, deliverables, and pitfalls stay visible so scope creep never quietly kills the project.",
    color: "var(--pale-blue)",
  },
];

const scopeCards = [
  { k: "Compare", v: "Three directions, ranked by effort and ambition — so you choose deliberately." },
  { k: "Coach", v: "Milestones and pitfalls stay visible, so you know what to protect and what to cut." },
  { k: "Prove", v: "The finished work says something specific about your judgment, not just your effort." },
  { k: "Trim", v: "Cut scope before it cuts you — every roadmap is sized to something you can finish." },
  { k: "Ship", v: "A shipped first version beats a perfect plan. Sevri keeps momentum over polish." },
];

const faqs = [
  {
    question: "Is this just another idea generator?",
    answer:
      "No. The point isn't novelty — it's the right fit for you: something you can finish and feel proud of.",
  },
  {
    question: "Who is it for?",
    answer: "Students 13+, especially high school and early college, who want to build something real.",
  },
  {
    question: "Do I need to know what to build?",
    answer: "No. Bring an interest and your time budget. Sevri turns that into a concrete direction.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Hero (dark "moment" + aurora shader) — fills the viewport under the fixed nav ── */}
      <section className="relative isolate -mt-20 flex min-h-[100svh] items-center overflow-hidden bg-navy-deep text-cream">
        <AuroraBackground />
        <HeroScrollFade className="relative z-10 mx-auto w-full max-w-editorial px-5 py-32 pt-40 sm:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="font-serif text-xl italic text-cream/70">Project-to-portfolio coaching</p>
            <h1 className="mt-5 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Build a project you&apos;ll actually finish.
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-cream/75">
              Choose a direction, scope it to something real, and follow it through — to work that&apos;s
              genuinely yours.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button href="/sign-up" size="lg" className="px-7">
                Start for free
              </Button>
              <Button href="/pricing" variant="contrast" size="lg" className="px-7">
                See pricing
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
              {proof.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full border border-cream/20 bg-cream/[0.04] px-4 py-1.5 text-sm text-cream/80 backdrop-blur-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))}
            </div>
          </Reveal>
        </HeroScrollFade>
      </section>

      {/* ── How it works ── */}
      <Section eyebrow="How it works" title="Three steps. No detours.">
        <div className="grid items-start gap-5 lg:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.08} className="h-full">
              <ExpandableCard
                num={step.num}
                numColor={step.color}
                title={step.title}
                body={step.body}
                more={step.more}
              />
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ── Two tracks (tinted feature cards — distinct from the step cards) ── */}
      <Section eyebrow="Two tracks" title="Build something, or study something.">
        <div className="grid gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="group flex h-full flex-col justify-between rounded-3xl bg-surface-mint p-8 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lifted sm:p-10">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-teal-deep/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-teal-deep">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-deep" />
                  Software
                </span>
                <h3 className="mt-6 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
                  Something another person can actually use.
                </h3>
                <ul className="mt-6 space-y-2.5 text-base leading-7 text-ink-soft">
                  <li>Starts with who it&apos;s for — before any code.</li>
                  <li>Scoped for a first version, not a startup pitch.</li>
                  <li>Easy to explain, worth showing.</li>
                </ul>
              </div>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-teal-deep">
                Explore the software track
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </span>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="group flex h-full flex-col justify-between rounded-3xl bg-primary-soft p-8 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lifted sm:p-10">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-coral/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-coral">
                  <span className="h-1.5 w-1.5 rounded-full bg-coral" />
                  Research
                </span>
                <h3 className="mt-6 font-display text-3xl leading-tight tracking-tight text-ink sm:text-4xl">
                  A question with a believable method.
                </h3>
                <ul className="mt-6 space-y-2.5 text-base leading-7 text-ink-soft">
                  <li>Sized around data you can actually collect.</li>
                  <li>A method and timeline that fit your real situation.</li>
                  <li>Worth submitting — and worth talking about.</li>
                </ul>
              </div>
              <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-coral">
                Explore the research track
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </span>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ── Scope discipline (dark moment, horizontal scroll marquee) ── */}
      <section className="overflow-hidden bg-navy py-20 text-cream sm:py-28">
        <Container className="mb-12">
          <Reveal className="max-w-3xl space-y-3">
            <p className="editorial-kicker text-cream/60">Scope discipline</p>
            <h2 className="font-display text-4xl leading-[1.02] tracking-tight sm:text-5xl">
              The project that ships beats the one that stalls.
            </h2>
          </Reveal>
        </Container>
        <ScopeMarquee items={scopeCards} />
      </section>

      {/* ── FAQ ── */}
      <Section eyebrow="FAQ" title="Before you start.">
        <FaqAccordion items={faqs} />
      </Section>

      {/* ── Final CTA ── */}
      <Section>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-navy px-8 py-16 text-center text-cream sm:px-16 sm:py-20">
            <div className="aurora-fallback pointer-events-none absolute inset-0 opacity-40" />
            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="font-display text-4xl leading-tight sm:text-5xl">Start here. See what fits.</h2>
              <p className="mx-auto mt-4 max-w-lg text-lg leading-8 text-cream/75">
                Free covers onboarding and up to {freeGenerationLimit} idea boards across both tracks.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button href="/sign-up" size="lg" className="px-7">
                  Create free account
                </Button>
                <Button href="/pricing" variant="contrast" size="lg" className="px-7">
                  Compare plans
                </Button>
              </div>
            </div>
          </div>
        </Reveal>
      </Section>
    </>
  );
}
