import assert from "node:assert/strict";
import test from "node:test";
import { activationStage, activityCycleKey, elapsedDays, inactivityStage } from "./sequence.ts";

test("activation sends day 3 then day 7 once", () => {
  assert.equal(activationStage(2, new Set()), null);
  assert.equal(activationStage(3, new Set()), 3);
  assert.equal(activationStage(7, new Set()), 3);
  assert.equal(activationStage(7, new Set([3])), 7);
  assert.equal(activationStage(14, new Set([3, 7])), null);
});

test("coach requires the first nudge before the two-week follow-up", () => {
  assert.equal(inactivityStage(6, new Set()), null);
  assert.equal(inactivityStage(7, new Set()), 7);
  assert.equal(inactivityStage(14, new Set()), 7);
  assert.equal(inactivityStage(14, new Set([7])), 14);
  assert.equal(inactivityStage(30, new Set([7, 14])), null);
});

test("progress timestamps create stable sequence cycles", () => {
  assert.equal(activityCycleKey("2026-08-07T12:34:56.789Z"), "2026-08-07T12-34-56-789Z");
  assert.equal(elapsedDays("2026-08-01T00:00:00Z", new Date("2026-08-08T00:00:00Z")), 7);
});
