import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface GoogleCalendarSyncSettingsRow {
  id: string;
  user_id: string;
  integration_id: string;
  calendar_id: string | null;
  calendar_summary: string;
  sync_enabled: boolean;
  status: "active" | "invalid" | "error";
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleCalendarSyncEventRow {
  id: string;
  user_id: string;
  project_id: string;
  item_key: string;
  item_type: "project_start" | "milestone" | "project_end" | "work_session";
  google_calendar_id: string;
  google_event_id: string;
  last_synced_hash: string;
  created_at: string;
  updated_at: string;
}

const SETTINGS_COLUMNS =
  "id, user_id, integration_id, calendar_id, calendar_summary, sync_enabled, status, last_synced_at, last_error, created_at, updated_at";

const EVENT_COLUMNS =
  "id, user_id, project_id, item_key, item_type, google_calendar_id, google_event_id, last_synced_hash, created_at, updated_at";

export async function getGoogleCalendarSyncSettings(userId: string): Promise<GoogleCalendarSyncSettingsRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendar_sync_settings")
    .select(SETTINGS_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Google Calendar sync settings: ${error.message}`);
  }

  return (data as GoogleCalendarSyncSettingsRow | null) ?? null;
}

export async function getGoogleCalendarSyncSettingsAdmin(userId: string): Promise<GoogleCalendarSyncSettingsRow | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendar_sync_settings")
    .select(SETTINGS_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Google Calendar sync settings: ${error.message}`);
  }

  return (data as GoogleCalendarSyncSettingsRow | null) ?? null;
}

export async function getGoogleCalendarSyncEventsForProject(input: {
  userId: string;
  projectId: string;
}): Promise<GoogleCalendarSyncEventRow[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendar_sync_events")
    .select(EVENT_COLUMNS)
    .eq("user_id", input.userId)
    .eq("project_id", input.projectId);

  if (error) {
    throw new Error(`Failed to load Google Calendar event mappings: ${error.message}`);
  }

  return (data as GoogleCalendarSyncEventRow[] | null) ?? [];
}

