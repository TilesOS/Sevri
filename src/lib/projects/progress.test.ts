import assert from "node:assert/strict";
import test from "node:test";
import { getProjectProgressPercent, getProjectProgressSummary } from "./progress.ts";

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

// ── The one progress number ──────────────────────────────────────────────────

test("percent is completed steps over total steps, never lifecycle credit", () => {
  assert.equal(getProjectProgressPercent(0, 5), 0);
  assert.equal(getProjectProgressPercent(3, 5), 60);
  assert.equal(getProjectProgressPercent(2, 5), 40);
  assert.equal(getProjectProgressPercent(5, 5), 100);
});

test("percent rounds to whole numbers", () => {
  assert.equal(getProjectProgressPercent(1, 3), 33);
  assert.equal(getProjectProgressPercent(2, 3), 67);
});

test("percent clamps out-of-range and empty inputs", () => {
  assert.equal(getProjectProgressPercent(0, 0), 0);
  assert.equal(getProjectProgressPercent(4, 0), 0);
  assert.equal(getProjectProgressPercent(-2, 5), 0);
  assert.equal(getProjectProgressPercent(9, 5), 100);
  assert.equal(getProjectProgressPercent(1, -5), 0);
});

test("a zero-step project reads 0 percent while sitting at the Scoped stage", () => {
  const progress = getProjectProgressSummary({
    hasRoadmap: true,
    completedCount: 0,
    totalMilestones: 0,
    projectStatus: "active",
  });

  assert.equal(progress.percent, 0);
  assert.equal(progress.stage, "scoped");
  assert.equal(progress.stageLabel, "Scoped");
});

test("a project with no roadmap reads 0 percent, not partial lifecycle credit", () => {
  const progress = getProjectProgressSummary({
    hasRoadmap: false,
    completedCount: 0,
    totalMilestones: 0,
    projectStatus: "active",
  });

  assert.equal(progress.percent, 0);
});

test("the summary percent matches the standalone calculator for every surface", () => {
  for (const [completed, total] of [
    [0, 5],
    [1, 5],
    [3, 5],
    [5, 5],
    [2, 3],
    [0, 0],
  ] as const) {
    const progress = getProjectProgressSummary({
      hasRoadmap: total > 0,
      completedCount: completed,
      totalMilestones: total,
      projectStatus: "active",
    });

    assert.equal(
      progress.percent,
      getProjectProgressPercent(completed, total),
      `percent disagreed for ${completed}/${total}`,
    );
    assert.equal(progress.completedSteps, completed);
    assert.equal(progress.totalSteps, total);
  }
});

test("percentDetail states the same fact the percentage measures", () => {
  const withSteps = getProjectProgressSummary({
    hasRoadmap: true,
    completedCount: 3,
    totalMilestones: 5,
    projectStatus: "active",
  });
  assert.equal(withSteps.percentDetail, "3 of 5 project steps complete");
  assert.equal(withSteps.percent, 60);

  const withoutSteps = getProjectProgressSummary({
    hasRoadmap: false,
    completedCount: 0,
    totalMilestones: 0,
    projectStatus: "active",
  });
  assert.equal(withoutSteps.percentDetail, "Project steps appear after the roadmap is generated");
});

test("a completed project with unfinished steps still reports honest step progress", () => {
  const progress = getProjectProgressSummary({
    hasRoadmap: true,
    completedCount: 2,
    totalMilestones: 5,
    projectStatus: "completed",
  });

  // The lifecycle stage may say shipped; the percentage never inflates past the work done.
  assert.equal(progress.stage, "shipped");
  assert.equal(progress.percent, 40);
});
