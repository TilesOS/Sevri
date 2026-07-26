import assert from "node:assert/strict";
import test from "node:test";
import { includesArchivedProjects } from "./archive-visibility.ts";

test("calendar schedule access excludes archived projects by default", () => {
  assert.equal(includesArchivedProjects(), false);
  assert.equal(includesArchivedProjects("calendar"), false);
});

test("workspace schedule access includes archived projects for focus blocks", () => {
  assert.equal(includesArchivedProjects("workspace"), true);
});
