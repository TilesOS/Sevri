import { addDaysToDateString, toCompactDateString } from "./date-utils.ts";
import type { CalendarDisplayItem } from "./types.ts";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toCompactDateTimeParts(input: {
  date: string;
  time: string;
  addMinutes?: number;
}) {
  const dateMatch = DATE_PATTERN.exec(input.date);
  const timeMatch = TIME_PATTERN.exec(input.time);
  if (!dateMatch || !timeMatch) {
    throw new Error("Invalid local date or time.");
  }

  const date = new Date(Date.UTC(
    Number.parseInt(dateMatch[1], 10),
    Number.parseInt(dateMatch[2], 10) - 1,
    Number.parseInt(dateMatch[3], 10),
    Number.parseInt(timeMatch[1], 10),
    Number.parseInt(timeMatch[2], 10) + (input.addMinutes ?? 0),
  ));

  return {
    date: `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`,
    time: `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}00`,
  };
}

function toCompactDateTime(input: {
  date: string;
  time: string;
  addMinutes?: number;
}) {
  const parts = toCompactDateTimeParts(input);
  return `${parts.date}T${parts.time}`;
}

function toGoogleDateRange(value: string) {
  const start = toCompactDateString(value);
  const end = toCompactDateString(addDaysToDateString(value, 1));
  return `${start}/${end}`;
}

export interface CalendarExportEvent {
  uid: string;
  title: string;
  description: string;
  date: string;
  startTime?: string;
  timezone?: string;
  durationMinutes?: number;
}

export function buildCalendarExportEvents(items: ReadonlyArray<CalendarDisplayItem>) {
  return items.map((item) => ({
    uid: `${item.id}@sevri.app`,
    title: item.title,
    description: item.description,
    date: item.date,
    startTime: item.startTime,
    timezone: item.scheduleTimezone,
    durationMinutes: item.durationMinutes,
  }));
}

export function buildIcsFile(input: {
  events: ReadonlyArray<CalendarExportEvent>;
  generatedAt?: Date;
}) {
  const generatedAt = input.generatedAt ?? new Date();
  const dtStamp = generatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sevri//Calendar v1//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  input.events.forEach((event) => {
    const durationMinutes = event.durationMinutes ?? 30;
    const timezone = event.timezone ?? "UTC";

    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(event.uid)}`,
      `DTSTAMP:${dtStamp}`,
    );

    if (event.startTime) {
      lines.push(
        `DTSTART;TZID=${timezone}:${toCompactDateTime({ date: event.date, time: event.startTime })}`,
        `DTEND;TZID=${timezone}:${toCompactDateTime({
          date: event.date,
          time: event.startTime,
          addMinutes: durationMinutes,
        })}`,
      );
    } else {
      lines.push(
        `DTSTART;VALUE=DATE:${toCompactDateString(event.date)}`,
        `DTEND;VALUE=DATE:${toCompactDateString(addDaysToDateString(event.date, 1))}`,
      );
    }

    lines.push(
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description)}`,
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function buildGoogleCalendarUrl(event: CalendarExportEvent) {
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title);
  url.searchParams.set("details", event.description);
  if (event.startTime) {
    url.searchParams.set(
      "dates",
      `${toCompactDateTime({ date: event.date, time: event.startTime })}/${toCompactDateTime({
        date: event.date,
        time: event.startTime,
        addMinutes: event.durationMinutes ?? 30,
      })}`,
    );
    url.searchParams.set("ctz", event.timezone ?? "UTC");
  } else {
    url.searchParams.set("dates", toGoogleDateRange(event.date));
  }
  return url.toString();
}
