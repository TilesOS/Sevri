import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth/guard";
import { resolveDisplayName } from "@/lib/auth/names";
import { AppHeaderClient } from "@/components/shared/app-header-client";

export async function AppHeader() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = resolveDisplayName({
    profileFullName: profile?.full_name,
    userMetadata: user.user_metadata,
    email: user.email,
  });

  return <AppHeaderClient displayName={displayName} />;
}
