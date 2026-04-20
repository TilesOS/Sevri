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

test("buildFallbackDurationDays stays conservative and respects track minima", () => {
  assert.equal(
    buildFallbackDurationDays({
      estimatedWeeks: 4,
      stepCount: 4,
      weeklyHours: 3,
      projectTrack: "software",
    }),
    9,
  );

  assert.equal(
    buildFallbackDurationDays({
      estimatedWeeks: 1,
      stepCount: 8,
      weeklyHours: null,
      projectTrack: "research",
    }),
    4,
  );
});
