import assert from "node:assert/strict";
import test from "node:test";
import { deriveUrgencyState } from "./urgency.ts";

test("deriveUrgencyState reflects completion and deadline proximity", () => {
  assert.equal(
    deriveUrgencyState({
      completed: true,
      date: "2026-04-22",
      today: "2026-04-19",
    }),
    "completed",
  );

  assert.equal(
    deriveUrgencyState({
      completed: false,
      date: "2026-04-18",
      today: "2026-04-19",
    }),
    "overdue",
  );

  assert.equal(
    deriveUrgencyState({
      completed: false,
      date: "2026-04-22",
      today: "2026-04-19",
    }),
    "due_soon",
  );

  assert.equal(
    deriveUrgencyState({
      completed: false,
      date: "2026-04-27",
      today: "2026-04-19",
    }),
    "on_track",
  );
});
