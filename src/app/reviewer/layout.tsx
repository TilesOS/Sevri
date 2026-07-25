import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getRequiredReviewerUser } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ReviewerShell } from "@/components/reviewer/reviewer-shell";

/** The reviewer surface shows another student's work; keep it out of indexes. */
export const metadata: Metadata = {
  title: { default: "Reviewer", template: "%s — Sevri" },
  robots: { index: false, follow: false },
};

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
