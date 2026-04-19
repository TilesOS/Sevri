import type { ReactNode } from "react";
import { getRequiredReviewerUser } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReviewerShell } from "@/components/reviewer/reviewer-shell";

export default async function ReviewerLayout({ children }: { children: ReactNode }) {
  const user = await getRequiredReviewerUser();
  const supabase = await createServerSupabaseClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName =
    profile?.display_name?.trim() || profile?.full_name?.trim() || null;

  return (
    <ReviewerShell displayName={displayName} email={user.email ?? null}>
      {children}
    </ReviewerShell>
  );
}
