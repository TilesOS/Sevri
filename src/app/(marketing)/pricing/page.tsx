import type { Metadata } from "next";
import { getMarketingViewer } from "@/lib/auth/viewer";
import { PLAN_LIMITS } from "@/lib/usage/limits";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Section } from "@/components/ui/section";

const freeGenerationLimit = PLAN_LIMITS.free.generation_limit;

// The free-tier number comes from the enforced plan limit, not a copy of it, so
// the search snippet can never disagree with the page or the gate.
const PRICING_DESCRIPTION = `Start free with ${freeGenerationLimit} idea board generations, or go Pro for unlimited boards, step coaching, and portfolio packaging.`;

export const metadata: Metadata = {
  title: "Pricing",
  description: PRICING_DESCRIPTION,
  openGraph: {
    title: "Pricing — Sevri",
    description: PRICING_DESCRIPTION,
  },
};

const comparisonRows = [
  { label: "Idea board generations", free: `${freeGenerationLimit} total`, pro: "Unlimited (fair-use)" },
  { label: "Onboarding + roadmap", free: "Included", pro: "Included" },
  { label: "Step-by-step coaching", free: "—", pro: "Detailed guidance + evaluation" },
  { label: "Portfolio packaging", free: "—", pro: "Included" },
];

const faqItems = [
  {
    question: "Should I start free?",
    answer: `Yes — the free tier runs onboarding and up to ${freeGenerationLimit} idea boards so you can see whether Sevri fits.`,
  },
  {
    question: "Who is Pro for?",
    answer: "Students who want unlimited generations plus detailed per-step coaching while they execute.",
  },
  {
    question: "Can I upgrade later?",
    answer: "Anytime. Most people start free, commit to a direction, then upgrade for depth.",
  },
];

const freeFeatures = [
  `${freeGenerationLimit} idea board generations`,
  "Both software and research tracks",
  "4-step onboarding wizard",
  "Roadmap + step tracking",
];

const proFeatures = [
  "Unlimited idea boards (fair-use)",
  "Detailed step guidance + evaluation",
  "Portfolio packaging",
  "Built for sustained execution",
];

export default async function PricingPage() {
  const viewer = await getMarketingViewer();

  // The plan cards address whoever is reading. Telling a signed-in student to
  // "Create account", or selling Pro to someone already paying for it, is the
  // kind of small incoherence that makes a paid product feel untended.
  const freeCta = viewer.isAuthenticated
    ? { href: "/dashboard", label: "Open workspace" }
    : { href: "/sign-up", label: "Start free" };
  const proCta = viewer.isPro
    ? { href: "/settings/billing", label: "Manage your plan" }
    : viewer.isAuthenticated
      ? { href: "/settings/billing", label: "Upgrade to Pro" }
      : { href: "/sign-up", label: "Create account" };
  const intro = viewer.isPro
    ? "You're on Pro: unlimited generations, per-step coaching, and portfolio packaging are all included."
    : viewer.isAuthenticated
      ? "You're on the free plan. Upgrade when you want unlimited generations and deeper coaching."
      : "Start free while you validate the workflow. Upgrade when you want unlimited generations and deeper coaching.";

  return (
    <>
      <Section className="pt-10">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="font-serif text-xl italic text-coral">Pricing</p>
          <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl">
            Simple pricing for serious students.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-lg leading-8 text-ink-soft">{intro}</p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="flex h-full flex-col rounded-3xl bg-paper p-8 shadow-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Free</p>
              <div className="mt-4 flex items-end gap-1.5">
                <span className="font-display text-5xl text-ink">$0</span>
                <span className="pb-1.5 text-sm text-ink-muted">/ month</span>
              </div>
              <ul className="mt-8 space-y-3.5 text-base leading-7 text-ink-soft">
                {freeFeatures.map((f) => (
                  <FeatureRow key={f} tone="light">
                    {f}
                  </FeatureRow>
                ))}
              </ul>
              <div className="mt-auto pt-10">
                <Button href={freeCta.href} variant="outline" fullWidth size="lg">
                  {freeCta.label}
                </Button>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-navy bg-navy p-8 text-cream shadow-lifted">
              <div className="aurora-fallback pointer-events-none absolute inset-0 opacity-25" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cream/50">Pro</p>
                  <span className="rounded-full bg-coral px-3 py-1 text-xs font-semibold text-ink">
                    {viewer.isPro ? "Your plan" : "Recommended"}
                  </span>
                </div>
                <div className="mt-4 flex items-end gap-1.5">
                  <span className="font-display text-5xl text-cream">$10</span>
                  <span className="pb-1.5 text-sm text-cream/60">/ month</span>
                </div>
                <ul className="mt-8 space-y-3.5 text-base leading-7 text-cream/80">
                  {proFeatures.map((f) => (
                    <FeatureRow key={f} tone="dark">
                      {f}
                    </FeatureRow>
                  ))}
                </ul>
                <div className="mt-auto pt-10">
                  <Button href={proCta.href} variant="contrast" fullWidth size="lg">
                    {proCta.label}
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Section>

      <Section eyebrow="Comparison" title="What changes when you upgrade.">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-line bg-paper">
          <div className="grid grid-cols-[1.4fr_0.8fr_1fr] border-b border-line bg-surface px-6 py-4 text-sm font-semibold text-ink">
            <span>Capability</span>
            <span>Free</span>
            <span>Pro</span>
          </div>
          {comparisonRows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-4 border-b border-line px-6 py-4 text-sm leading-6 text-ink-soft last:border-b-0"
            >
              <span className="font-semibold text-ink">{row.label}</span>
              <span>{row.free}</span>
              <span>{row.pro}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section eyebrow="FAQ" title="Common questions.">
        <FaqAccordion items={faqItems} />
      </Section>
    </>
  );
}

function FeatureRow({ children, tone }: { children: React.ReactNode; tone: "light" | "dark" }) {
  return (
    <li className="flex items-start gap-3">
      <span className={tone === "dark" ? "mt-1 text-coral" : "mt-1 text-teal-deep"}>✓</span>
      <span>{children}</span>
    </li>
  );
}
