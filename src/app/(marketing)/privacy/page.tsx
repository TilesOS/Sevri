import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

export default function PrivacyPage() {
  return (
    <Section className="pt-14 sm:pt-20">
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        description="How Sevri collects, uses, and protects your information."
      />
      <Card className="max-w-4xl">
        <div className="space-y-8 text-sm leading-7 text-ink-soft">
          <p className="text-xs uppercase tracking-wide text-ink-soft/70">Last updated: June 1, 2026</p>

          <p>
            Sevri (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps students choose, scope, and finish meaningful
            software and research projects. This policy explains what we collect, why we collect it, and the
            choices you have. We collect only what we need to run your account and generate useful guidance.
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Information we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-ink">Account information</span> — your email address and
                authentication details, including data shared by a sign-in provider (such as Google) when you
                choose to use it.
              </li>
              <li>
                <span className="font-medium text-ink">Onboarding and profile data</span> — the responses you
                provide during onboarding and any profile details you save.
              </li>
              <li>
                <span className="font-medium text-ink">Workspace data</span> — the recommendations, projects,
                roadmaps, and step guidance generated as you use Sevri.
              </li>
              <li>
                <span className="font-medium text-ink">Usage and billing data</span> — basic activity needed to
                enforce plan limits, plus subscription status maintained by our payment processor.
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">How we use your information</h2>
            <p>
              We use your information to operate your account, generate and improve recommendations and
              roadmaps, keep your workspace coherent across sessions, enforce plan limits, process payments,
              and respond to support requests. We do not use your private workspace content to train public
              models.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Service providers</h2>
            <p>
              We rely on a small number of trusted providers to deliver Sevri — including infrastructure and
              database hosting, authentication, AI generation, and payment processing. These providers handle
              data only as needed to perform their service and under their own confidentiality and security
              obligations.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Sharing</h2>
            <p>
              We do not sell your personal information, and we do not share your private account data except
              with the service providers above, when required by law, or to protect the rights and safety of
              our users and the service.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Data retention</h2>
            <p>
              We keep your information for as long as your account is active. You can review or update your
              saved profile from settings. If you ask us to delete your account, we remove your personal data
              except where we are required to retain certain records (for example, billing history).
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Security</h2>
            <p>
              Access to your data is protected by per-user access controls at the database level and encrypted
              connections in transit. No system is perfectly secure, but we work to safeguard your information
              and limit access to what is necessary.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Your choices</h2>
            <p>
              You can access and update your profile data in settings, and request a copy or deletion of your
              data by contacting us. You may also disconnect a third-party sign-in provider at any time.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Contact</h2>
            <p>
              Questions about this policy or your data? Email us at{" "}
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
