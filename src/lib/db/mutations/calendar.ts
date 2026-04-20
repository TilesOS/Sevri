import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTimeZone } from "@/lib/calendar/date-utils";
import type { GeneratedProjectSchedule, ScheduleGenerationSource } from "@/lib/calendar/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Database } from "@/types/db";

type AppSupabaseClient = SupabaseClient<Database>;

async function getClient(client?: AppSupabaseClient) {
  if (client) {
    return client;
  }

  return await createServerSupabaseClient();
}

export async function clearProjectSchedule(input: {
  projectId: string;
  timeZone?: string | null;
  client?: AppSupabaseClient;
}) {
  const supabase = await getClient(input.client);
  const normalizedTimeZone = normalizeTimeZone(input.timeZone);

  const [{ error: roadmapError }, { error: milestoneError }] = await Promise.all([
    supabase
      .from("project_roadmaps")
      .update({
        scheduled_start_date: null,
        scheduled_end_date: null,
        schedule_timezone: normalizedTimeZone,
        schedule_generation_source: null,
        last_schedule_rebalanced_at: null,
      })
      .eq("project_id", input.projectId),
    supabase
      .from("milestones")
      .update({
        due_date: null,
        schedule_duration_days: null,
        is_user_scheduled_override: false,
      })
      .eq("project_id", input.projectId),
  ]);

  if (roadmapError) {
    throw new Error(`Failed to clear schedule metadata: ${roadmapError.message}`);
  }

  if (milestoneError) {
    throw new Error(`Failed to clear schedule milestones: ${milestoneError.message}`);
  }
}

export async function persistProjectSchedule(input: {
  projectId: string;
  schedule: GeneratedProjectSchedule;
  source: ScheduleGenerationSource;
  client?: AppSupabaseClient;
  lastScheduleRebalancedAt?: string | null;
}) {
  await persistProjectSchedulePatch({
    projectId: input.projectId,
    scheduledStartDate: input.schedule.scheduledStartDate,
    scheduledEndDate: input.schedule.scheduledEndDate,
    scheduleTimezone: input.schedule.scheduleTimezone,
    source: input.source,
    client: input.client,
    lastScheduleRebalancedAt: input.lastScheduleRebalancedAt,
    milestoneUpdates: input.schedule.milestones,
  });
}

export async function persistProjectSchedulePatch(input: {
  projectId: string;
  scheduledStartDate: string | null;
  scheduledEndDate: string | null;
  scheduleTimezone: string;
  source: ScheduleGenerationSource;
  client?: AppSupabaseClient;
  lastScheduleRebalancedAt?: string | null;
  milestoneUpdates: Array<{
    id: string;
    dueDate: string;
    scheduleDurationDays: number;
    isUserScheduledOverride: boolean;
  }>;
}) {
  const supabase = await getClient(input.client);
  const { error: roadmapError } = await supabase
    .from("project_roadmaps")
    .update({
      scheduled_start_date: input.scheduledStartDate,
      scheduled_end_date: input.scheduledEndDate,
      schedule_timezone: input.scheduleTimezone,
      schedule_generation_source: input.source,
      last_schedule_rebalanced_at: input.lastScheduleRebalancedAt ?? null,
    })
    .eq("project_id", input.projectId);

  if (roadmapError) {
    throw new Error(`Failed to persist project schedule: ${roadmapError.message}`);
  }

  await Promise.all(
    input.milestoneUpdates.map(async (milestone) => {
      const { error } = await supabase
        .from("milestones")
        .update({
          due_date: milestone.dueDate,
          schedule_duration_days: milestone.scheduleDurationDays,
          is_user_scheduled_override: milestone.isUserScheduledOverride,
        })
        .eq("id", milestone.id)
        .eq("project_id", input.projectId);

      if (error) {
        throw new Error(`Failed to persist milestone schedule: ${error.message}`);
      }
    }),
  );
}
