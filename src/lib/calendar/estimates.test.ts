import assert from "node:assert/strict";
import test from "node:test";
import { buildFallbackDurationDays, parseRoughTimeEstimateDays } from "./estimates.ts";

test("parseRoughTimeEstimateDays handles ranges and fuzzy phrasing", () => {
  assert.equal(parseRoughTimeEstimateDays("3-4 days"), 4);
  assert.equal(parseRoughTimeEstimateDays("1-2 weeks"), 14);
  assert.equal(parseRoughTimeEstimateDays("About 1 week"), 7);
  assert.equal(parseRoughTimeEstimateDays("roughly 5 days"), 5);
  assert.equal(parseRoughTimeEstimateDays("a couple of days"), 2);
  assert.equal(parseRoughTimeEstimateDays("unknown"), null);
});

test("buildFallbackDurationDays stays conservative and enforces the minimum step duration", () => {
  // Low availability stretches the schedule: 4 weeks * 7 * 1.25 = 35 days over 4 steps.
  assert.equal(
    buildFallbackDurationDays({
      estimatedWeeks: 4,
      stepCount: 4,
      weeklyHours: 3,
    }),
    9,
  );

  // Missing weekly hours falls back to 6h/week, and the 3-day floor wins
  // over the 1-day-per-step the raw arithmetic would produce.
  assert.equal(
    buildFallbackDurationDays({
      estimatedWeeks: 1,
      stepCount: 8,
      weeklyHours: null,
    }),
    3,
  );
});

test("buildFallbackDurationDays scales with weekly availability", () => {
  const base = { estimatedWeeks: 2, stepCount: 2 };

  // <= 4h/week -> 1.25x, <= 6h/week -> 1.1x, above -> no padding.
  assert.equal(buildFallbackDurationDays({ ...base, weeklyHours: 4 }), 9);
  assert.equal(buildFallbackDurationDays({ ...base, weeklyHours: 6 }), 8);
  assert.equal(buildFallbackDurationDays({ ...base, weeklyHours: 12 }), 7);
});
