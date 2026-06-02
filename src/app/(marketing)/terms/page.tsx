import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

export default function TermsPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <PageHeader
        eyebrow="Legal"
        title="Terms of Service"
        description="The agreement that governs your use of Sevri."
      />
      <Card className="max-w-4xl">
        <div className="space-y-8 text-sm leading-7 text-ink-soft">
          <p className="text-xs uppercase tracking-wide text-ink-soft/70">Last updated: June 1, 2026</p>

          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of Sevri. By creating an
            account or using the service, you agree to these Terms. If you do not agree, please do not use
            Sevri.
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">The service</h2>
            <p>
              Sevri is a coaching and planning tool that helps students choose, scope, and finish meaningful
              software and research projects. It generates recommendations, roadmaps, and step-by-step guidance.
              This guidance is provided for educational purposes and is not a guarantee of any particular
              academic, career, or project outcome.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Your account</h2>
            <p>
              You must provide accurate information and keep your login credentials secure. You are responsible
              for activity under your account. You must be old enough to form a binding contract in your
              jurisdiction to use Sevri.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Acceptable use</h2>
            <p>
              Use Sevri lawfully and respectfully. Do not misuse the service, attempt to disrupt or
              reverse-engineer it, circumvent plan limits or access controls, or use it to violate the rights
              of others or any applicable academic-integrity rules. We may suspend or terminate accounts that
              violate these Terms.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Plans and billing</h2>
            <p>
              Sevri offers a free plan and paid plans with higher limits and additional features. Paid
              subscriptions are billed in advance through our payment processor and renew automatically until
              canceled. You can cancel at any time; cancellation stops future renewals and takes effect at the
              end of the current billing period. Fees already paid are non-refundable except where required by
              law.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Your content</h2>
            <p>
              You retain ownership of the inputs and project work you provide. You grant us the limited rights
              needed to operate the service and generate guidance for you. We may use aggregated, de-identified
              information to improve Sevri.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Intellectual property</h2>
            <p>
              Sevri, including its software, design, and content, is owned by us and protected by applicable
              law. These Terms do not grant you any rights in Sevri other than the right to use the service as
              permitted here.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Disclaimers and liability</h2>
            <p>
              Sevri is provided &ldquo;as is&rdquo; without warranties of any kind. AI-generated guidance may be
              incomplete or inaccurate, and you are responsible for reviewing it before acting on it. To the
              fullest extent permitted by law, we are not liable for indirect or consequential damages, and our
              total liability is limited to the amount you paid us in the twelve months before the claim.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Changes to these Terms</h2>
            <p>
              We may update these Terms from time to time. If we make material changes, we will update the date
              above and, where appropriate, notify you. Continued use of Sevri after changes take effect means
              you accept the revised Terms.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Contact</h2>
            <p>
              Questions about these Terms? Email us at{" "}
              <a className="font-medium text-ink underline" href="mailto:support@sevri.co">
                support@sevri.co
              </a>
              .
            </p>
          </div>
        </div>
        <div className="mt-8">
          <Button href="/" variant="outline" className="rounded-full">
            Return home
          </Button>
        </div>
      </Card>
    </Section>
  );
}
