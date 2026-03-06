import { createAdminSupabaseClient } from "@/lib/supabase/admin";

interface RateLimitInput {
  userId: string;
  endpoint: string;
  maxRequests: number;
  windowMinutes: number;
}

export async function enforceRateLimit(input: RateLimitInput) {
  const supabase = createAdminSupabaseClient();
  const eventType = `rate_limit:${input.endpoint}`;
  const windowStart = new Date(Date.now() - input.windowMinutes * 60_000).toISOString();

  const { count, error } = await supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("event_type", eventType)
    .gte("created_at", windowStart);

  if (error) {
    throw new Error(`Rate limit check failed: ${error.message}`);
  }

  if ((count ?? 0) >= input.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + input.windowMinutes * 60_000).toISOString(),
    };
  }

  const { error: insertError } = await supabase.from("usage_events").insert({
    user_id: input.userId,
    event_type: eventType,
    metadata_json: { endpoint: input.endpoint },
  });

  if (insertError) {
    throw new Error(`Rate limit track failed: ${insertError.message}`);
  }

  return {
    allowed: true,
    remaining: Math.max(input.maxRequests - ((count ?? 0) + 1), 0),
    resetAt: new Date(Date.now() + input.windowMinutes * 60_000).toISOString(),
  };
}