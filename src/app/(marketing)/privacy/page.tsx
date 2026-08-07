import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Sevri collects, uses, and protects student information.",
  openGraph: {
    title: "Privacy Policy — Sevri",
    description: "How Sevri collects, uses, and protects student information.",
  },
};

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
          <p className="text-xs uppercase tracking-wide text-ink-soft/70">Last updated: August 7, 2026</p>

          <p>
            Sevri (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps students choose, scope, and finish meaningful
            software and research projects. Sevri is the controller of personal information processed through
            the service. You can contact us at{" "}
            <a className="font-medium text-ink underline" href="mailto:support@sevri.co">
              support@sevri.co
            </a>
            .
          </p>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Information we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <span className="font-medium text-ink">Account and authentication data</span>: your name, email
                address, login details, authentication provider identifiers, and related account records.
              </li>
              <li>
                <span className="font-medium text-ink">Student profile and onboarding data</span>: student
                stage, target outcome, interests, favorite subjects, coding experience, available weekly time,
                project style, known tools, target schools or companies, preferred difficulty, constraints, and
                raw onboarding answers.
              </li>
              <li>
                <span className="font-medium text-ink">Workspace and AI output data</span>: normalized profiles,
                model outputs, recommendations, projects, roadmaps, milestones, step guidance, portfolio
                curation, generation metadata, and feedback you provide about generated content.
              </li>
              <li>
                <span className="font-medium text-ink">Submissions and files</span>: pasted work, uploaded
                files, filenames, storage paths, featured evidence notes, AI evaluations, and related review
                records.
              </li>
              <li>
                <span className="font-medium text-ink">Integrations and portfolio data</span>: GitHub OAuth
                scopes, encrypted GitHub tokens, GitHub user and repository identifiers, cached repository
                activity, portfolio exports, public portfolio pages, display-name choices, and publication
                acknowledgements.
              </li>
              <li>
                <span className="font-medium text-ink">Usage, billing, support, and diagnostics</span>: usage
                events, rate-limit records, plan status, Stripe customer and subscription identifiers, payment
                records handled by Stripe, support messages, email delivery data, and error or performance logs.
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">How we use your information</h2>
            <p>
              We use your information to create and secure accounts, generate recommendations and project
              guidance, keep your workspace coherent, evaluate submitted work, package portfolio materials,
              publish portfolio pages when you ask us to, enforce plan limits and fair-use controls, process
              payments, send service emails, and—when you choose them—send activation and project-coaching
              reminders, debug the service, prevent abuse, comply with law, and respond to support requests. We
              do not use your private workspace content to train public models.
            </p>
            <p>
              AI features process your profile, onboarding answers, project context, submissions, and portfolio
              inputs to generate or evaluate content for you. AI-generated guidance may be inaccurate and should
              be reviewed before you rely on it.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Service providers and recipients</h2>
            <p>
              We share information with service providers only as needed to operate Sevri. Current provider
              categories include Supabase for hosting, database, storage, authentication, and row-level access
              controls; OpenAI for AI generation and evaluation; Stripe for checkout, subscriptions, and payment
              processing; Resend for transactional and optional coaching email; GitHub when you connect a repository or sign in with
              GitHub; and Sentry for error monitoring. We may also disclose information if required by law, to
              protect rights and safety, or in connection with a business transfer.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Public portfolio pages</h2>
            <p>
              Your workspace is private by default. If you publish a portfolio page, the selected public fields
              become available to anyone with the public URL and may be indexed or copied by others. Publishing
              requires you to attest that you are at least 16 years old and acknowledge that the page is public.
              You can unpublish a page from Sevri, but copies already viewed, saved, or indexed by third parties
              may remain outside our control.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Children and student users</h2>
            <p>
              Sevri is designed for students ages 13 and older. If you are under 13, you may use Sevri only with
              verifiable consent from a parent or guardian, and the parent or guardian should contact us before
              account creation. We do not knowingly collect personal information from children under 13 without
              required consent. If you believe a child under 13 provided information without consent, contact us
              and we will take appropriate steps, including deletion where required.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Retention</h2>
            <p>
              We keep personal information for as long as needed to provide the service, maintain your account,
              comply with legal obligations, resolve disputes, enforce agreements, and protect the service. You
              can request deletion of your account data; we may retain limited records such as billing, security,
              abuse-prevention, or legal records where required or permitted by law.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">International transfers</h2>
            <p>
              Sevri and its providers may process information in the United States and other countries where our
              providers operate. Those countries may have data-protection laws that differ from your location. We
              rely on appropriate safeguards where required for international transfers.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">EU/EEA and UK rights</h2>
            <p>
              Where GDPR or UK data-protection law applies, our legal bases may include performance of a
              contract, consent, legitimate interests in operating and securing Sevri, and compliance with legal
              obligations. You may have rights to access, correct, delete, restrict, object to, or port your
              personal information, and to withdraw consent where processing is based on consent. You may also
              complain to your local supervisory authority.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">California privacy</h2>
            <p>
              Sevri does not currently sell personal information or share it for cross-context behavioral
              advertising, and we do not use sensitive personal information to infer characteristics. If the
              CCPA/CPRA applies to Sevri, California residents may request access, correction, deletion,
              portability, and information about categories collected, sources, purposes, retention, and
              disclosure categories for the last 12 months. We will not discriminate against you for exercising
              privacy rights. Submit requests at{" "}
              <a className="font-medium text-ink underline" href="mailto:support@sevri.co">
                support@sevri.co
              </a>
              .
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Security</h2>
            <p>
              Access to your data is protected by per-user access controls at the database level and encrypted
              connections in transit. GitHub tokens are encrypted before storage. No system is perfectly secure,
              but we work to safeguard your information and limit access to what is necessary.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Your choices</h2>
            <p>
              You can access and update profile data in settings, disconnect GitHub or other third-party sign-in
              providers, unpublish portfolio pages, and request access, correction, deletion, or a copy of your
              data by contacting us.
            </p>
            <p>
              Activation and project-coaching emails are optional. You can turn them off in Settings or use the
              unsubscribe link in any such email. Essential account, security, invitation, billing, and requested
              project-service messages may still be sent. Coaching reminders use recorded workspace progress and,
              when you connect a repository, recent GitHub commit activity to decide whether a project appears idle.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-ink">Contact</h2>
            <p>
              Questions about this policy, privacy rights, or child-data deletion requests? Email us at{" "}
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
