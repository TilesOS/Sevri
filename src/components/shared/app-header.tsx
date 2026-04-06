import type { ReactNode } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRequiredUser } from "@/lib/auth/guard";
import { resolveDisplayName } from "@/lib/auth/names";
import { AppShellClient } from "@/components/shared/app-header-client";

interface AppShellProps {
  children: ReactNode;
  secondaryNavigation?: ReactNode;
}

export async function AppShell({ children, secondaryNavigation }: AppShellProps) {
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

  return (
    <AppShellClient displayName={displayName} email={user.email} secondaryNavigation={secondaryNavigation}>
      {children}
    </AppShellClient>
  );
}
