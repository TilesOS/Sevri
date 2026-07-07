import Link from "next/link";
import { SettingsForm } from "@/components/settings/settings-form";
import { Card } from "@/components/ui/card";
import { getRequiredUser } from "@/lib/auth/guard";
import { resolveStoredFullName } from "@/lib/auth/names";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { settingsProfileSchema, type SettingsProfileInput } from "@/lib/validators/settings";

export default async function SettingsPage() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, student_stage, target_outcome, project_track")
    .eq("user_id", user.id)
    .maybeSingle();

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
      <div>
        <div className="kicker" style={{ marginBottom: 10 }}>
          <span className="star">✦</span>
          <span style={{ color: 'var(--ink-muted)' }}>~ account settings ~</span>
        </div>
        <h1 className="display" style={{ margin: 0 }}>
          Keep your <span className="hl-yellow">defaults</span> honest
          <span style={{ color: 'var(--cyan)' }}>.</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--ink-soft)', marginTop: 16, maxWidth: 600, lineHeight: 1.6 }}>
          These details shape the context Sevri uses across onboarding, recommendations, and the rest of your project workspace.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <SettingsForm email={user.email ?? ""} initialValues={settingsValues} />
        <Card className="space-y-4 bg-surface-mint" elevation="soft">
          <p className="editorial-kicker">What these defaults affect</p>
          <h2 className="text-3xl font-semibold text-ink">A better starting point every time you return.</h2>
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            <li>Recommended track selection when you return to the ideas board.</li>
            <li>Profile context that helps Sevri keep outputs aligned with your current goals.</li>
            <li>More consistent software and research guidance across the workspace.</li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3" tone="blush" elevation="soft">
          <p className="editorial-kicker">Billing</p>
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
          <p className="editorial-kicker">Integrations</p>
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
