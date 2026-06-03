import assert from "node:assert/strict";
import test from "node:test";
import { countProjectCommits, countWords } from "./output-metrics.ts";

test("countWords handles plain text, contractions, and numbers", () => {
  assert.equal(countWords("Drafted 250 words for the lit-review's opening."), 7);
});

test("countProjectCommits ignores duplicate shas and pre-selection commits", () => {
  const selectedAt = "2026-06-01T12:00:00.000Z";

  assert.equal(
    countProjectCommits(
      [
        { sha: "before", author: { date: "2026-06-01T11:59:59.000Z" } },
        { sha: "after", author: { date: "2026-06-01T12:00:00.000Z" } },
        { sha: "after", author: { date: "2026-06-01T12:05:00.000Z" } },
        { sha: "unknown-date", author: { date: "" } },
        { sha: "", author: { date: "2026-06-01T12:10:00.000Z" } },
      ],
      selectedAt,
    ),
    2,
  );
});

test("countProjectCommits returns zero for missing cache payloads", () => {
  assert.equal(countProjectCommits(null, "2026-06-01T12:00:00.000Z"), 0);
  assert.equal(countProjectCommits({ sha: "not-an-array" }, "2026-06-01T12:00:00.000Z"), 0);
});
