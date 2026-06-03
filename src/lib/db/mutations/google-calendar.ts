import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { GoogleCalendarSyncSettingsRow } from "@/lib/db/queries/google-calendar";

export async function upsertGoogleCalendarSyncSettings(input: {
  userId: string;
  integrationId: string;
  calendarId?: string | null;
  calendarSummary?: string;
  syncEnabled?: boolean;
  status?: "active" | "invalid" | "error";
  lastSyncedAt?: string | null;
  lastError?: string | null;
}): Promise<GoogleCalendarSyncSettingsRow> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendar_sync_settings")
    .upsert(
      {
        user_id: input.userId,
        integration_id: input.integrationId,
        calendar_id: input.calendarId ?? null,
        calendar_summary: input.calendarSummary ?? "Sevri",
        sync_enabled: input.syncEnabled ?? true,
        status: input.status ?? "active",
        last_synced_at: input.lastSyncedAt ?? null,
        last_error: input.lastError ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select(
      "id, user_id, integration_id, calendar_id, calendar_summary, sync_enabled, status, last_synced_at, last_error, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(`Failed to save Google Calendar sync settings: ${error?.message ?? "unknown"}`);
  }

  return data as GoogleCalendarSyncSettingsRow;
}

export async function updateGoogleCalendarSyncSettings(input: {
  userId: string;
  calendarId?: string | null;
  calendarSummary?: string;
  syncEnabled?: boolean;
  status?: "active" | "invalid" | "error";
  lastSyncedAt?: string | null;
  lastError?: string | null;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.calendarId !== undefined) update.calendar_id = input.calendarId;
  if (input.calendarSummary !== undefined) update.calendar_summary = input.calendarSummary;
  if (input.syncEnabled !== undefined) update.sync_enabled = input.syncEnabled;
  if (input.status !== undefined) update.status = input.status;
  if (input.lastSyncedAt !== undefined) update.last_synced_at = input.lastSyncedAt;
  if (input.lastError !== undefined) update.last_error = input.lastError;

  const { error } = await supabase
    .from("google_calendar_sync_settings")
    .update(update)
    .eq("user_id", input.userId);

  if (error) {
    throw new Error(`Failed to update Google Calendar sync settings: ${error.message}`);
  }
}

export async function deleteGoogleCalendarSyncData(userId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const [{ error: eventError }, { error: settingsError }] = await Promise.all([
    supabase.from("google_calendar_sync_events").delete().eq("user_id", userId),
    supabase.from("google_calendar_sync_settings").delete().eq("user_id", userId),
  ]);

  if (eventError) {
    throw new Error(`Failed to delete Google Calendar event mappings: ${eventError.message}`);
  }

  if (settingsError) {
    throw new Error(`Failed to delete Google Calendar sync settings: ${settingsError.message}`);
  }
}

export async function upsertGoogleCalendarSyncEvent(input: {
  userId: string;
  projectId: string;
  itemKey: string;
  itemType: "project_start" | "milestone" | "project_end" | "work_session";
  googleCalendarId: string;
  googleEventId: string;
  lastSyncedHash: string;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("google_calendar_sync_events")
    .upsert(
      {
        user_id: input.userId,
        project_id: input.projectId,
        item_key: input.itemKey,
        item_type: input.itemType,
        google_calendar_id: input.googleCalendarId,
        google_event_id: input.googleEventId,
        last_synced_hash: input.lastSyncedHash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,project_id,item_key" },
    );

  if (error) {
    throw new Error(`Failed to save Google Calendar event mapping: ${error.message}`);
  }
}

export async function deleteGoogleCalendarSyncEvent(input: {
  userId: string;
  projectId: string;
  itemKey: string;
}): Promise<void> {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("google_calendar_sync_events")
    .delete()
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId)
    .eq("item_key", input.itemKey);

  if (error) {
    throw new Error(`Failed to delete Google Calendar event mapping: ${error.message}`);
  }
}

