import type { Metadata } from "next";
import Link from "next/link";
import { SettingsForm } from "@/components/settings/settings-form";
import { EmailPreferencesCard } from "@/components/settings/email-preferences-card";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getRequiredUser } from "@/lib/auth/guard";
import { resolveStoredFullName } from "@/lib/auth/names";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { settingsProfileSchema, type SettingsProfileInput } from "@/lib/validators/settings";
import { getEmailPreference } from "@/lib/email/preferences";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();

  const [{ data: profile }, emailPreference] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, student_stage, target_outcome, project_track")
      .eq("user_id", user.id)
      .maybeSingle(),
    getEmailPreference(user.id),
  ]);

  const initialSettings = settingsProfileSchema.safeParse({
    full_name: resolveStoredFullName({
      profileFullName: profile?.full_name,
      userMetadata: user.user_metadata,
      email: user.email,
    }),
    student_stage: profile?.student_stage ?? "high_school_junior",
    target_outcome: profile?.target_outcome ?? "portfolio",
    project_track: profile?.project_track ?? "software",
  });

  const fallbackSettings: SettingsProfileInput = {
    full_name: resolveStoredFullName({
      profileFullName: profile?.full_name,
      userMetadata: user.user_metadata,
      email: user.email,
    }),
    student_stage: "high_school_junior",
    target_outcome: "portfolio",
    project_track: "software",
  };

  const settingsValues = initialSettings.success ? initialSettings.data : fallbackSettings;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Account" title="Settings" description="Manage the defaults Sevri uses across onboarding, ideas, and project guidance." />
      <SettingsNav />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <SettingsForm email={user.email ?? ""} initialValues={settingsValues} />
        <Card className="space-y-4 bg-surface" elevation="soft">
          <p className="text-xs font-medium text-ink-muted">What these defaults affect</p>
          <h2 className="text-lg font-semibold text-ink">A better starting point every time you return.</h2>
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            <li>Recommended track selection when you return to the ideas board.</li>
            <li>Profile context that helps Sevri keep outputs aligned with your current goals.</li>
            <li>More consistent software and research guidance across the workspace.</li>
          </ul>
        </Card>
      </div>

      <EmailPreferencesCard
        initialEnabled={emailPreference.lifecycleEnabled}
        suppressed={Boolean(emailPreference.suppressedAt)}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3" tone="blush" elevation="soft">
          <p className="text-sm font-medium text-ink">Billing</p>
          <p className="text-sm leading-6 text-ink-soft">
            Review your current plan, upgrade to Sevri Pro, or open the billing portal.
          </p>
          <Link
            href="/settings/billing"
            className="inline-flex items-center text-sm font-semibold text-ink hover:underline"
          >
            Manage billing -&gt;
          </Link>
        </Card>

        <Card className="space-y-3" tone="butter" elevation="soft">
          <p className="text-sm font-medium text-ink">Integrations</p>
          <p className="text-sm leading-6 text-ink-soft">
            Connect GitHub to sync commits and READMEs with your projects.
          </p>
          <Link
            href="/settings/integrations"
            className="inline-flex items-center text-sm font-semibold text-ink hover:underline"
          >
            Manage integrations -&gt;
          </Link>
        </Card>
      </div>
    </div>
  );
}
