import assert from "node:assert/strict";
import test from "node:test";
import { applyMoveOnly, applyRebalanceDownstream, generateProjectSchedule } from "./schedule.ts";
import type { ProjectScheduleState, ScheduleMilestoneInput } from "./types.ts";

function buildMilestones(): ScheduleMilestoneInput[] {
  return [
    {
      id: "step-1",
      orderIndex: 0,
      stepNumber: 1,
      title: "Define scope",
      roughTimeEstimate: "3-4 days",
      dueDate: "2026-04-23",
      scheduleDurationDays: 4,
      completed: false,
      isUserScheduledOverride: false,
    },
    {
      id: "step-2",
      orderIndex: 1,
      stepNumber: 2,
      title: "Build prototype",
      roughTimeEstimate: "About 1 week",
      dueDate: "2026-04-30",
      scheduleDurationDays: 7,
      completed: false,
      isUserScheduledOverride: false,
    },
    {
      id: "step-3",
      orderIndex: 2,
      stepNumber: 3,
      title: "Ship polish",
      roughTimeEstimate: null,
      dueDate: "2026-05-18",
      scheduleDurationDays: 18,
      completed: false,
      isUserScheduledOverride: false,
    },
  ];
}

function buildProjectState(): ProjectScheduleState {
  return {
    projectId: "project-1",
    projectTitle: "Portfolio Builder",
    projectTrack: "software",
    projectStatus: "active",
    scheduledStartDate: "2026-04-20",
    scheduledEndDate: "2026-05-18",
    scheduleTimezone: "America/New_York",
    scheduleGenerationSource: "roadmap_generation",
    lastScheduleRebalancedAt: null,
    milestones: buildMilestones(),
  };
}

test("generateProjectSchedule uses AI estimates first and falls back conservatively", () => {
  const schedule = generateProjectSchedule({
    milestones: buildMilestones().map((milestone) => ({
      ...milestone,
      dueDate: null,
      scheduleDurationDays: null,
    })),
    estimatedWeeks: 6,
    weeklyHours: 4,
    projectTrack: "software",
    timeZone: "America/New_York",
    startDate: "2026-04-20",
  });

  assert.equal(schedule.scheduledStartDate, "2026-04-20");
  assert.equal(schedule.scheduledEndDate, "2026-05-18");
  assert.deepEqual(
    schedule.milestones.map((milestone) => ({
      id: milestone.id,
      dueDate: milestone.dueDate,
      scheduleDurationDays: milestone.scheduleDurationDays,
    })),
    [
      { id: "step-1", dueDate: "2026-04-23", scheduleDurationDays: 4 },
      { id: "step-2", dueDate: "2026-04-30", scheduleDurationDays: 7 },
      { id: "step-3", dueDate: "2026-05-18", scheduleDurationDays: 18 },
    ],
  );
});

test("applyMoveOnly rejects moves that violate milestone order", () => {
  assert.throws(
    () =>
      applyMoveOnly({
        project: buildProjectState(),
        itemType: "milestone",
        milestoneId: "step-2",
        targetDate: "2026-05-20",
      }),
    /next scheduled step/i,
  );
});

test("applyMoveOnly marks a milestone override and extends project completion when needed", () => {
  const nextState = applyMoveOnly({
    project: buildProjectState(),
    itemType: "milestone",
    milestoneId: "step-3",
    targetDate: "2026-05-21",
  });

  assert.equal(nextState.scheduledEndDate, "2026-05-21");
  assert.deepEqual(nextState.milestones, [
    {
      id: "step-3",
      dueDate: "2026-05-21",
      scheduleDurationDays: 18,
      isUserScheduledOverride: true,
    },
  ]);
});

test("applyRebalanceDownstream preserves order and stored durations", () => {
  const nextState = applyRebalanceDownstream({
    project: buildProjectState(),
    itemType: "milestone",
    milestoneId: "step-2",
    targetDate: "2026-05-03",
  });

  assert.equal(nextState.scheduledStartDate, "2026-04-20");
  assert.equal(nextState.scheduledEndDate, "2026-05-21");
  assert.deepEqual(nextState.milestones, [
    {
      id: "step-2",
      dueDate: "2026-05-03",
      scheduleDurationDays: 7,
      isUserScheduledOverride: true,
    },
    {
      id: "step-3",
      dueDate: "2026-05-21",
      scheduleDurationDays: 18,
      isUserScheduledOverride: false,
    },
  ]);
});

test("applyRebalanceDownstream can shift the whole project from a new kickoff date", () => {
  const nextState = applyRebalanceDownstream({
    project: buildProjectState(),
    itemType: "project_start",
    targetDate: "2026-04-27",
  });

  assert.equal(nextState.scheduledStartDate, "2026-04-27");
  assert.equal(nextState.scheduledEndDate, "2026-05-25");
  assert.deepEqual(
    nextState.milestones.map((milestone) => milestone.dueDate),
    ["2026-04-30", "2026-05-07", "2026-05-25"],
  );
});
