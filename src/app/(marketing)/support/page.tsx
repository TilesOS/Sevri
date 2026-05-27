import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/page-transition";
import { Section } from "@/components/ui/section";

export default function SupportPage() {
  return (
    <PageTransition>
      <Section className="pt-14 sm:pt-20">
        <div style={{ marginBottom: 40 }}>
          <div className="kicker" style={{ marginBottom: 10 }}>
            <span className="star">✦</span>
            <span>SUPPORT</span>
          </div>
          <h1 className="display" style={{ margin: 0 }}>
            Need help with <span className="hl-yellow">Sevri</span>
            <span style={{ color: 'var(--cyan)' }}>?</span>
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 16, maxWidth: 600, lineHeight: 1.6 }}>
            This route is reserved for onboarding help, billing questions, recommendation troubleshooting, and workspace guidance.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card style={{ borderTop: '4px solid var(--cyan)' }}>
            <h2 className="text-2xl font-semibold text-ink">What this page will become</h2>
            <p className="mt-4 text-sm leading-7 text-ink-soft">
              A public support surface with contact paths, billing help, and fast answers for the most
              common issues students hit while using the workspace.
            </p>
          </Card>
          <Card style={{ borderTop: '4px solid var(--yellow)', borderColor: 'var(--ink)', backgroundColor: 'rgba(255,217,61,0.07)' }}>
            <h2 className="text-2xl font-semibold text-ink">Current status</h2>
            <p className="mt-4 text-sm leading-7 text-ink-soft">
              This is intentionally minimal for now, but the route is fully designed and ready for real
              support content when it is time to ship.
            </p>
            <div className="mt-6">
              <Button href="/" variant="outline" className="rounded-full">
                Return home
              </Button>
            </div>
          </Card>
        </div>
      </Section>
    </PageTransition>
  );
}
