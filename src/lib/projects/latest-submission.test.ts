import assert from "node:assert/strict";
import test from "node:test";
import {
  pickLatestSubmissionPerMilestone,
  selectPortfolioEvidence,
  sortSubmissionsNewestFirst,
} from "./latest-submission.ts";

function submission(id: string, milestoneId: string, createdAt: string) {
  return { id, milestone_id: milestoneId, created_at: createdAt };
}

test("sorts newest first and breaks ties on id descending", () => {
  const sorted = sortSubmissionsNewestFirst([
    submission("a", "m1", "2026-04-23T10:00:00.000Z"),
    submission("c", "m1", "2026-04-23T12:00:00.000Z"),
    submission("b", "m1", "2026-04-23T12:00:00.000Z"),
  ]);

  assert.deepEqual(
    sorted.map((row) => row.id),
    ["c", "b", "a"],
  );
});

test("keeps only the newest revision of each milestone", () => {
  const latest = pickLatestSubmissionPerMilestone([
    submission("old-1", "m1", "2026-04-01T09:00:00.000Z"),
    submission("new-1", "m1", "2026-05-02T09:00:00.000Z"),
    submission("only-2", "m2", "2026-04-15T09:00:00.000Z"),
  ]);

  assert.deepEqual(
    latest.map((row) => row.id),
    ["new-1", "only-2"],
  );
});

test("treats unparseable timestamps as oldest instead of throwing", () => {
  const latest = pickLatestSubmissionPerMilestone([
    submission("broken", "m1", "not-a-date"),
    submission("good", "m1", "2026-04-01T09:00:00.000Z"),
  ]);

  assert.deepEqual(
    latest.map((row) => row.id),
    ["good"],
  );
});

test("empty input produces empty output", () => {
  assert.deepEqual(pickLatestSubmissionPerMilestone([]), []);
  assert.deepEqual(selectPortfolioEvidence([], null), []);
  assert.deepEqual(selectPortfolioEvidence([], "missing-id"), []);
});

test("evidence keeps a pinned older revision alongside the latest ones", () => {
  const rows = [
    submission("old-1", "m1", "2026-04-01T09:00:00.000Z"),
    submission("new-1", "m1", "2026-05-02T09:00:00.000Z"),
    submission("only-2", "m2", "2026-04-15T09:00:00.000Z"),
  ];

  const evidence = selectPortfolioEvidence(rows, "old-1");

  assert.deepEqual(
    evidence.map((row) => row.id),
    ["new-1", "only-2", "old-1"],
  );
});

test("evidence does not duplicate a pinned submission that is already latest", () => {
  const rows = [
    submission("old-1", "m1", "2026-04-01T09:00:00.000Z"),
    submission("new-1", "m1", "2026-05-02T09:00:00.000Z"),
  ];

  assert.deepEqual(
    selectPortfolioEvidence(rows, "new-1").map((row) => row.id),
    ["new-1"],
  );
});

test("evidence ignores a pinned id that no longer exists", () => {
  const rows = [submission("new-1", "m1", "2026-05-02T09:00:00.000Z")];

  assert.deepEqual(
    selectPortfolioEvidence(rows, "deleted-submission").map((row) => row.id),
    ["new-1"],
  );
});
