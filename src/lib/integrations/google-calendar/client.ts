import { addDaysToDateString } from "@/lib/calendar/date-utils";
import type { CalendarDisplayItem } from "@/lib/calendar/types";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GoogleCalendarResponse {
  id: string;
  summary: string;
}

interface GoogleEventResponse {
  id: string;
}

interface GoogleApiError {
  error?: {
    code?: number;
    message?: string;
  };
}

function getErrorMessage(payload: GoogleApiError | null, status: number) {
  return payload?.error?.message ?? `Google Calendar API returned HTTP ${status}`;
}

async function parseGoogleResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as (T & GoogleApiError) | null;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.status));
  }

  if (!payload) {
    throw new Error("Google Calendar API returned an empty response.");
  }

  return payload as T;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function addMinutesToLocalDateTime(input: {
  date: string;
  time: string;
  minutes: number;
}) {
  const [yearPart, monthPart, dayPart] = input.date.split("-");
  const [hourPart, minutePart] = input.time.split(":");
  const date = new Date(Date.UTC(
    Number.parseInt(yearPart, 10),
    Number.parseInt(monthPart, 10) - 1,
    Number.parseInt(dayPart, 10),
    Number.parseInt(hourPart, 10),
    Number.parseInt(minutePart, 10) + input.minutes,
  ));

  return {
    date: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    time: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`,
  };
}

function buildGoogleEventPayload(item: CalendarDisplayItem) {
  const description = `${item.description}\n\nManaged by Sevri. Edit this item in Sevri to keep sync reliable.`;
  const timezone = item.scheduleTimezone ?? "UTC";

  if (item.startTime) {
    const end = addMinutesToLocalDateTime({
      date: item.date,
      time: item.startTime,
      minutes: item.durationMinutes ?? 30,
    });

    return {
      summary: item.title,
      description,
      start: {
        dateTime: `${item.date}T${item.startTime}:00`,
        timeZone: timezone,
      },
      end: {
        dateTime: `${end.date}T${end.time}:00`,
        timeZone: timezone,
      },
    };
  }

  return {
    summary: item.title,
    description,
    start: {
      date: item.date,
    },
    end: {
      date: addDaysToDateString(item.date, 1),
    },
  };
}

export function buildGoogleCalendarEventHash(item: CalendarDisplayItem) {
  return JSON.stringify(buildGoogleEventPayload(item));
}

export function createGoogleCalendarClient(accessToken: string) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    return parseGoogleResponse<T>(response);
  }

  return {
    async createCalendar(summary = "Sevri") {
      return request<GoogleCalendarResponse>("/calendars", {
        method: "POST",
        body: JSON.stringify({
          summary,
          description: "Project schedules and planned work blocks from Sevri.",
          timeZone: "UTC",
        }),
      });
    },

    async upsertEvent(input: {
      calendarId: string;
      item: CalendarDisplayItem;
      googleEventId?: string | null;
    }) {
      const encodedCalendarId = encodeURIComponent(input.calendarId);
      const payload = buildGoogleEventPayload(input.item);

      if (input.googleEventId) {
        return request<GoogleEventResponse>(
          `/calendars/${encodedCalendarId}/events/${encodeURIComponent(input.googleEventId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
      }

      return request<GoogleEventResponse>(`/calendars/${encodedCalendarId}/events`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async deleteEvent(input: {
      calendarId: string;
      googleEventId: string;
    }) {
      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.googleEventId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.status === 404 || response.status === 410) {
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as GoogleApiError | null;
        throw new Error(getErrorMessage(payload, response.status));
      }
    },

    async deleteCalendar(calendarId: string) {
      const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 404 || response.status === 410) {
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as GoogleApiError | null;
        throw new Error(getErrorMessage(payload, response.status));
      }
    },
  };
}

