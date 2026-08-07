import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export interface EmailPreferenceState {
  lifecycleEnabled: boolean;
  enrolledAt: string | null;
  suppressedAt: string | null;
  suppressionReason: string | null;
  onboardingDefaultEnabled: boolean;
}

export async function getEmailPreference(userId: string): Promise<EmailPreferenceState> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("email_preferences")
    .select("lifecycle_enabled, enrolled_at, delivery_suppressed_at, delivery_suppression_reason, onboarding_default_enabled")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load email preferences: ${error.message}`);
  return {
    lifecycleEnabled: data?.lifecycle_enabled ?? false,
    enrolledAt: data?.enrolled_at ?? null,
    suppressedAt: data?.delivery_suppressed_at ?? null,
    suppressionReason: data?.delivery_suppression_reason ?? null,
    onboardingDefaultEnabled: data?.onboarding_default_enabled ?? false,
  };
}

export async function setLifecycleEmailPreference(userId: string, enabled: boolean) {
  const supabase = createAdminSupabaseClient();
  const current = await getEmailPreference(userId);
  if (enabled && current.suppressedAt) {
    throw new Error("delivery_suppressed");
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("email_preferences").upsert(
    {
      user_id: userId,
      lifecycle_enabled: enabled,
      onboarding_default_enabled: false,
      enrolled_at: enabled ? (current.lifecycleEnabled ? current.enrolledAt ?? now : now) : current.enrolledAt,
      unsubscribed_at: enabled ? null : now,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Failed to save email preferences: ${error.message}`);
}

export async function suppressLifecycleEmail(userId: string, reason: string) {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("email_preferences").upsert(
    {
      user_id: userId,
      lifecycle_enabled: false,
      onboarding_default_enabled: false,
      delivery_suppressed_at: now,
      delivery_suppression_reason: reason.slice(0, 120),
      unsubscribed_at: now,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Failed to suppress lifecycle email: ${error.message}`);
}
