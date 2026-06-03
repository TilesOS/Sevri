import assert from "node:assert/strict";
import test from "node:test";
import { getProjectProgressSummary } from "./progress.ts";

test("project without a roadmap is selected but not scoped", () => {
  const progress = getProjectProgressSummary({
    hasRoadmap: false,
    completedCount: 0,
    totalMilestones: 0,
    projectStatus: "active",
  });

  assert.equal(progress.stage, "chosen");
  assert.equal(progress.items.find((item) => item.id === "chosen")?.state, "current");
  assert.equal(progress.items.find((item) => item.id === "scoped")?.state, "locked");
});

test("roadmap with no completed milestones is scoped", () => {
  const progress = getProjectProgressSummary({
    hasRoadmap: true,
    completedCount: 0,
    totalMilestones: 4,
    projectStatus: "active",
  });

  assert.equal(progress.stage, "scoped");
  assert.equal(progress.items.find((item) => item.id === "scoped")?.state, "current");
  assert.equal(progress.items.find((item) => item.id === "step_work")?.label, "Steps 0/4");
});

test("partial milestone completion tracks the current step", () => {
  const progress = getProjectProgressSummary({
    hasRoadmap: true,
    completedCount: 2,
    totalMilestones: 5,
    projectStatus: "active",
  });

  assert.equal(progress.stage, "step_work");
  assert.equal(progress.stageLabel, "Step 3 of 5");
});

test("all milestones complete counts as shipped", () => {
  const progress = getProjectProgressSummary({
    hasRoadmap: true,
    completedCount: 3,
    totalMilestones: 3,
    projectStatus: "active",
  });

  assert.equal(progress.stage, "shipped");
  assert.equal(progress.percent, 100);
});
