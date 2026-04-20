import assert from "node:assert/strict";
import test from "node:test";
import { buildCalendarExportEvents, buildGoogleCalendarUrl, buildIcsFile } from "./export.ts";
import type { CalendarDisplayItem } from "./types.ts";

function buildItems(): CalendarDisplayItem[] {
  return [
    {
      id: "project-1:start",
      projectId: "project-1",
      projectTitle: "Portfolio Builder",
      projectTrack: "software",
      itemType: "project_start",
      title: "Portfolio Builder kickoff",
      date: "2026-04-20",
      status: "not_started",
      urgency: "on_track",
      stepNumber: null,
      isUserScheduledOverride: false,
      href: "/project/project-1",
      description: "Portfolio Builder - Kickoff on 2026-04-20.",
    },
    {
      id: "step-1",
      projectId: "project-1",
      projectTitle: "Portfolio Builder",
      projectTrack: "software",
      itemType: "milestone",
      title: "Step 1: Define scope",
      date: "2026-04-23",
      status: "in_progress",
      urgency: "due_soon",
      stepNumber: 1,
      isUserScheduledOverride: false,
      href: "/project/project-1/steps/1",
      description: "Portfolio Builder - Step 1 is due on 2026-04-23: Define scope.",
    },
    {
      id: "project-1:end",
      projectId: "project-1",
      projectTitle: "Portfolio Builder",
      projectTrack: "software",
      itemType: "project_end",
      title: "Portfolio Builder completion target",
      date: "2026-05-18",
      status: "not_started",
      urgency: "on_track",
      stepNumber: null,
      isUserScheduledOverride: false,
      href: "/project/project-1",
      description: "Portfolio Builder - Completion target on 2026-05-18.",
    },
  ];
}

test("buildCalendarExportEvents preserves titles and dates", () => {
  const events = buildCalendarExportEvents(buildItems());

  assert.deepEqual(
    events.map((event) => ({ uid: event.uid, title: event.title, date: event.date })),
    [
      { uid: "project-1:start@sevri.app", title: "Portfolio Builder kickoff", date: "2026-04-20" },
      { uid: "step-1@sevri.app", title: "Step 1: Define scope", date: "2026-04-23" },
      { uid: "project-1:end@sevri.app", title: "Portfolio Builder completion target", date: "2026-05-18" },
    ],
  );
});

test("buildIcsFile creates deterministic all-day calendar events", () => {
  const events = buildCalendarExportEvents(buildItems());
  const ics = buildIcsFile({
    events,
    generatedAt: new Date("2026-04-19T12:00:00.000Z"),
  });

  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTAMP:20260419T120000Z/);
  assert.match(ics, /DTSTART;VALUE=DATE:20260420/);
  assert.match(ics, /DTEND;VALUE=DATE:20260421/);
  assert.match(ics, /SUMMARY:Portfolio Builder kickoff/);
  assert.match(ics, /END:VCALENDAR/);
});

test("buildGoogleCalendarUrl uses a one-day all-day range", () => {
  const [event] = buildCalendarExportEvents(buildItems());
  const url = new URL(buildGoogleCalendarUrl(event));

  assert.equal(url.origin, "https://calendar.google.com");
  assert.equal(url.searchParams.get("action"), "TEMPLATE");
  assert.equal(url.searchParams.get("text"), "Portfolio Builder kickoff");
  assert.equal(url.searchParams.get("dates"), "20260420/20260421");
});
