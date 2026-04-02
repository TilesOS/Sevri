import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { AppEvent } from "@/lib/analytics/events";

export async function trackEvent(
  userId: string,
  eventType: AppEvent,
  metadata: Record<string, unknown> = {},
) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("usage_events").insert({
    user_id: userId,
    event_type: eventType,
    metadata_json: metadata,
  });

  if (error) {
    throw new Error(`Failed to track event (${eventType}): ${error.message}`);
  }
}
