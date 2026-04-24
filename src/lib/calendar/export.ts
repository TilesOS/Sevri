import { addDaysToDateString, toCompactDateString } from "./date-utils.ts";
import type { CalendarDisplayItem } from "./types.ts";

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
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
}

export function buildCalendarExportEvents(items: ReadonlyArray<CalendarDisplayItem>) {
  return items.map((item) => ({
    uid: `${item.id}@sevri.app`,
    title: item.title,
    description: item.description,
    date: item.date,
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
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(event.uid)}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${toCompactDateString(event.date)}`,
      `DTEND;VALUE=DATE:${toCompactDateString(addDaysToDateString(event.date, 1))}`,
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
  url.searchParams.set("dates", toGoogleDateRange(event.date));
  return url.toString();
}
