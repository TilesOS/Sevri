import assert from "node:assert/strict";
import test from "node:test";
import { getStepGuidanceGate } from "./step-guidance-lock.ts";

test("step 1 guidance is unlocked", () => {
  const gate = getStepGuidanceGate(
    [
      { order_index: 0, completed: false },
      { order_index: 1, completed: false },
    ],
    0,
  );

  assert.deepEqual(gate, {
    guidanceLocked: false,
    previousStepNumber: null,
  });
});

test("step 2 guidance is locked until step 1 is complete", () => {
  const gate = getStepGuidanceGate(
    [
      { order_index: 0, completed: false },
      { order_index: 1, completed: false },
    ],
    1,
  );

  assert.deepEqual(gate, {
    guidanceLocked: true,
    previousStepNumber: 1,
  });
});

test("step 2 guidance unlocks when step 1 is complete", () => {
  const gate = getStepGuidanceGate(
    [
      { order_index: 0, completed: true },
      { order_index: 1, completed: false },
    ],
    1,
  );

  assert.deepEqual(gate, {
    guidanceLocked: false,
    previousStepNumber: 1,
  });
});

test("step guidance checks only the immediately previous step", () => {
  const gate = getStepGuidanceGate(
    [
      { order_index: 0, completed: false },
      { order_index: 1, completed: true },
      { order_index: 2, completed: false },
      { order_index: 3, completed: false },
    ],
    2,
  );

  assert.deepEqual(gate, {
    guidanceLocked: false,
    previousStepNumber: 2,
  });
});
