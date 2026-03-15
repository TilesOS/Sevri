import { getRequiredUser } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { resolveStoredFullName } from "@/lib/auth/names";
import { SettingsForm } from "@/components/settings/settings-form";
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
    <div className="space-y-6">
      <Card className="space-y-2">
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-700">Update the profile details Sevri uses across your workspace.</p>
      </Card>

      <SettingsForm email={user.email ?? ""} initialValues={settingsValues} />
    </div>
  );
}
