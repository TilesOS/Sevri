import { trackEvent } from "@/lib/analytics/track";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function trackPortfolioReflectionSavedDebounced(input: {
  userId: string;
  portfolioEntryId: string;
  projectId: string;
}) {
  const supabase = createAdminSupabaseClient();
  const windowStart = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("usage_events")
    .select("metadata_json")
    .eq("user_id", input.userId)
    .eq("event_type", "portfolio_reflection_saved")
    .gte("created_at", windowStart)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to check portfolio reflection event debounce: ${error.message}`);
  }

  const alreadyTracked = (data ?? []).some((event) => {
    const metadata = event.metadata_json as Record<string, unknown> | null;
    return metadata?.portfolio_entry_id === input.portfolioEntryId;
  });

  if (alreadyTracked) {
    return;
  }

  await trackEvent(input.userId, "portfolio_reflection_saved", {
    portfolio_entry_id: input.portfolioEntryId,
    project_id: input.projectId,
  });
}
