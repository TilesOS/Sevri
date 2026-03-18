import { getRequiredUser } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveStoredFullName } from "@/lib/auth/names";
import { SettingsForm } from "@/components/settings/settings-form";
import { settingsProfileSchema, type SettingsProfileInput } from "@/lib/validators/settings";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

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
      <PageHeader
        eyebrow="Settings"
        title="Keep your workspace defaults honest."
        description="These details shape the context Sevri uses across onboarding, recommendations, and the rest of your project workspace."
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <SettingsForm email={user.email ?? ""} initialValues={settingsValues} />
        <Card tone="primary" className="space-y-4">
          <p className="editorial-kicker">What these defaults affect</p>
          <h2 className="text-3xl font-semibold text-ink">A better starting point every time you return.</h2>
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            <li>Recommended track selection when you return to the ideas board.</li>
            <li>Profile context that helps Sevri keep outputs aligned with your current goals.</li>
            <li>More consistent software and research guidance across the workspace.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
