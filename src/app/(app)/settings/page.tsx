import { getRequiredUser } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { resolveDisplayName } from "@/lib/auth/names";

export default async function SettingsPage() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, student_stage, target_outcome, project_track")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = resolveDisplayName({
    profileFullName: profile?.full_name,
    userMetadata: user.user_metadata,
    email: user.email,
  });

  return (
    <div className="space-y-6">
      <Card className="space-y-2">
        <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
        <p className="text-sm text-ink-700">Account and profile details.</p>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm text-ink-600">Email: {user.email}</p>
        <p className="text-sm text-ink-600">Name: {displayName}</p>
        <p className="text-sm text-ink-600">Student stage: {profile?.student_stage ?? "Not set"}</p>
        <p className="text-sm text-ink-600">Target outcome: {profile?.target_outcome ?? "Not set"}</p>
        <p className="text-sm text-ink-600">
          Default track: {profile?.project_track === "research" ? "Research" : "Software"}
        </p>
      </Card>
    </div>
  );
}
