import { buildProjectCalendarItems } from "@/lib/calendar/items";
import type { ProjectScheduleState } from "@/lib/calendar/types";
import {
  deleteGoogleCalendarSyncEvent,
  updateGoogleCalendarSyncSettings,
  upsertGoogleCalendarSyncEvent,
} from "@/lib/db/mutations/google-calendar";
import { updateUserIntegrationTokens } from "@/lib/db/mutations/github";
import {
  getGoogleCalendarSyncEventsForProject,
  getGoogleCalendarSyncSettingsAdmin,
} from "@/lib/db/queries/google-calendar";
import { getUserIntegrationWithToken } from "@/lib/db/queries/github";
import {
  buildGoogleCalendarEventHash,
  createGoogleCalendarClient,
} from "@/lib/integrations/google-calendar/client";
import { refreshGoogleCalendarToken } from "@/lib/integrations/google-calendar/oauth";
import { decryptToken, encryptToken } from "@/lib/integrations/github/encryption";

function isTokenExpiring(value: string | null) {
  if (!value) {
    return true;
  }

  return new Date(value).getTime() <= Date.now() + 60_000;
}

async function getFreshAccessToken(userId: string) {
  const integration = await getUserIntegrationWithToken(userId, "google_calendar");
  if (!integration || integration.status !== "active") {
    return null;
  }

  if (!isTokenExpiring(integration.token_expires_at)) {
    return decryptToken(integration.access_token_encrypted);
  }

  if (!integration.refresh_token_encrypted) {
    await updateGoogleCalendarSyncSettings({
      userId,
      status: "invalid",
      lastError: "Google did not provide a refresh token. Reconnect Google Calendar.",
    });
    return null;
  }

  const refreshToken = decryptToken(integration.refresh_token_encrypted);
  const refreshed = await refreshGoogleCalendarToken(refreshToken);
  await updateUserIntegrationTokens({
    userId,
    provider: "google_calendar",
    accessTokenEncrypted: encryptToken(refreshed.token.access_token),
    tokenExpiresAt: refreshed.tokenExpiresAt,
    status: "active",
  });

  return refreshed.token.access_token;
}

export async function getGoogleCalendarClientForUser(userId: string) {
  const accessToken = await getFreshAccessToken(userId);
  return accessToken ? createGoogleCalendarClient(accessToken) : null;
}

async function ensureSyncCalendar(input: {
  userId: string;
  calendarSummary: string;
  calendarId: string | null;
}) {
  const client = await getGoogleCalendarClientForUser(input.userId);
  if (!client) {
    return null;
  }

  if (input.calendarId) {
    return {
      client,
      calendarId: input.calendarId,
    };
  }

  const calendar = await client.createCalendar(input.calendarSummary);
  await updateGoogleCalendarSyncSettings({
    userId: input.userId,
    calendarId: calendar.id,
    calendarSummary: calendar.summary || input.calendarSummary,
    status: "active",
    lastError: null,
  });

  return {
    client,
    calendarId: calendar.id,
  };
}

export async function syncProjectToGoogleCalendar(input: {
  userId: string;
  project: ProjectScheduleState;
}) {
  const settings = await getGoogleCalendarSyncSettingsAdmin(input.userId);
  if (!settings || !settings.sync_enabled || settings.status === "invalid") {
    return { skipped: true as const };
  }

  try {
    const calendar = await ensureSyncCalendar({
      userId: input.userId,
      calendarSummary: settings.calendar_summary,
      calendarId: settings.calendar_id,
    });

    if (!calendar) {
      return { skipped: true as const };
    }

    const items = buildProjectCalendarItems({ project: input.project });
    const mappings = await getGoogleCalendarSyncEventsForProject({
      userId: input.userId,
      projectId: input.project.projectId,
    });
    const mappingByItemKey = new Map(mappings.map((mapping) => [mapping.item_key, mapping]));
    const currentItemKeys = new Set(items.map((item) => item.id));

    for (const item of items) {
      const hash = buildGoogleCalendarEventHash(item);
      const mapping = mappingByItemKey.get(item.id);
      if (mapping?.last_synced_hash === hash && mapping.google_calendar_id === calendar.calendarId) {
        continue;
      }

      const event = await calendar.client.upsertEvent({
        calendarId: calendar.calendarId,
        item,
        googleEventId: mapping?.google_event_id,
      });

      await upsertGoogleCalendarSyncEvent({
        userId: input.userId,
        projectId: input.project.projectId,
        itemKey: item.id,
        itemType: item.itemType,
        googleCalendarId: calendar.calendarId,
        googleEventId: event.id,
        lastSyncedHash: hash,
      });
    }

    for (const mapping of mappings) {
      if (currentItemKeys.has(mapping.item_key)) {
        continue;
      }

      await calendar.client.deleteEvent({
        calendarId: mapping.google_calendar_id,
        googleEventId: mapping.google_event_id,
      });
      await deleteGoogleCalendarSyncEvent({
        userId: input.userId,
        projectId: input.project.projectId,
        itemKey: mapping.item_key,
      });
    }

    await updateGoogleCalendarSyncSettings({
      userId: input.userId,
      status: "active",
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
    });

    return { skipped: false as const, itemCount: items.length };
  } catch (error) {
    await updateGoogleCalendarSyncSettings({
      userId: input.userId,
      status: "error",
      lastError: error instanceof Error ? error.message : "Google Calendar sync failed.",
    });
    throw error;
  }
}

