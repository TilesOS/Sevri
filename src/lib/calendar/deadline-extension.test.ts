import assert from "node:assert/strict";
import { test } from "node:test";
import { getDeadlineExtensionDecision, getDeadlineExtensionReviewTarget } from "./deadline-extension.ts";

test("kickoff rebalances review the resulting project completion deadline", () => {
  const target = getDeadlineExtensionReviewTarget({
    itemType: "project_start",
    targetDate: "2026-06-03",
    moveMode: "rebalance_downstream",
    nextScheduledEndDate: "2026-06-30",
  });

  assert.deepEqual(target, {
    itemType: "project_end",
    milestoneId: null,
    requestedDate: "2026-06-30",
  });
});

test("moving kickoff only is not a deadline extension review target", () => {
  const target = getDeadlineExtensionReviewTarget({
    itemType: "project_start",
    targetDate: "2026-06-03",
    moveMode: "move_only",
    nextScheduledEndDate: "2026-06-30",
  });

  assert.equal(target, null);
});

test("moving a due date earlier does not require warning or cooldown", () => {
  const decision = getDeadlineExtensionDecision({
    currentDate: "2026-06-10",
    targetDate: "2026-06-08",
    history: { extensionCount: 5, latestExtensionCreatedAt: "2026-06-01T12:00:00.000Z" },
    confirmed: false,
    now: new Date("2026-06-01T12:00:00.000Z"),
  });

  assert.equal(decision.status, "not_extension");
});

test("first two later moves require confirmation", () => {
  const firstDecision = getDeadlineExtensionDecision({
    currentDate: "2026-06-10",
    targetDate: "2026-06-12",
    history: { extensionCount: 0, latestExtensionCreatedAt: null },
    confirmed: false,
    now: new Date("2026-06-01T12:00:00.000Z"),
  });

  assert.equal(firstDecision.status, "confirmation_required");
  assert.equal("extensionNumber" in firstDecision ? firstDecision.extensionNumber : null, 1);

  const secondDecision = getDeadlineExtensionDecision({
    currentDate: "2026-06-12",
    targetDate: "2026-06-14",
    history: { extensionCount: 1, latestExtensionCreatedAt: "2026-06-01T12:00:00.000Z" },
    confirmed: false,
    now: new Date("2026-06-02T12:00:00.000Z"),
  });

  assert.equal(secondDecision.status, "confirmation_required");
  assert.equal("extensionNumber" in secondDecision ? secondDecision.extensionNumber : null, 2);
});

test("third later move is blocked during the two day cooldown", () => {
  const decision = getDeadlineExtensionDecision({
    currentDate: "2026-06-14",
    targetDate: "2026-06-16",
    history: { extensionCount: 2, latestExtensionCreatedAt: "2026-06-01T12:00:00.000Z" },
    confirmed: true,
    now: new Date("2026-06-02T12:00:00.000Z"),
  });

  assert.equal(decision.status, "cooldown_active");
  assert.equal("cooldownEndsAt" in decision ? decision.cooldownEndsAt : null, "2026-06-03");
});

test("third later move can proceed after cooldown with confirmation", () => {
  const warning = getDeadlineExtensionDecision({
    currentDate: "2026-06-14",
    targetDate: "2026-06-16",
    history: { extensionCount: 2, latestExtensionCreatedAt: "2026-06-01T12:00:00.000Z" },
    confirmed: false,
    now: new Date("2026-06-03T12:00:00.000Z"),
  });

  assert.equal(warning.status, "confirmation_required");
  assert.equal("extensionNumber" in warning ? warning.extensionNumber : null, 3);

  const allowed = getDeadlineExtensionDecision({
    currentDate: "2026-06-14",
    targetDate: "2026-06-16",
    history: { extensionCount: 2, latestExtensionCreatedAt: "2026-06-01T12:00:00.000Z" },
    confirmed: true,
    now: new Date("2026-06-03T12:00:00.000Z"),
  });

  assert.equal(allowed.status, "allowed");
  assert.equal("extensionNumber" in allowed ? allowed.extensionNumber : null, 3);
});
