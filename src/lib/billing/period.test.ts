import assert from "node:assert/strict";
import test from "node:test";
import {
  getBillingPeriodState,
  getSubscriptionStatusLabel,
  isStaleBillingPeriod,
} from "./period.ts";

const NOW = Date.parse("2026-07-24T12:00:00.000Z");

test("an active subscription with a future period renews", () => {
  const state = getBillingPeriodState({
    status: "active",
    currentPeriodEnd: "2026-08-11T22:07:41.000Z",
    now: NOW,
  });

  assert.equal(state.kind, "renews");
  assert.equal(state.kind === "renews" && state.endsAt, "2026-08-11T22:07:41.000Z");
});

test("an active subscription whose period has elapsed is reported as stale, not as a date", () => {
  const state = getBillingPeriodState({
    status: "active",
    currentPeriodEnd: "2026-04-11T22:07:41.000Z",
    now: NOW,
  });

  assert.equal(state.kind, "stale");
  assert.equal(
    isStaleBillingPeriod({ status: "active", currentPeriodEnd: "2026-04-11T22:07:41.000Z", now: NOW }),
    true,
  );
});

test("a period ending exactly now counts as stale", () => {
  assert.equal(
    getBillingPeriodState({ status: "active", currentPeriodEnd: new Date(NOW).toISOString(), now: NOW }).kind,
    "stale",
  );
});

test("a trialing subscription reports the trial end", () => {
  assert.equal(
    getBillingPeriodState({ status: "trialing", currentPeriodEnd: "2026-08-01T00:00:00.000Z", now: NOW }).kind,
    "trial_ends",
  );
});

test("payment problems are reported without a date", () => {
  for (const status of ["past_due", "unpaid"]) {
    assert.equal(
      getBillingPeriodState({ status, currentPeriodEnd: "2026-04-11T22:07:41.000Z", now: NOW }).kind,
      "payment_issue",
    );
  }
});

test("non-entitled statuses never render a period date", () => {
  for (const status of ["canceled", "inactive", "incomplete", "checkout_pending", "checkout_completed"]) {
    assert.equal(
      getBillingPeriodState({ status, currentPeriodEnd: "2026-08-11T22:07:41.000Z", now: NOW }).kind,
      "none",
    );
  }
});

test("missing or unparseable dates report nothing rather than throwing", () => {
  assert.equal(getBillingPeriodState({ status: "active", currentPeriodEnd: null, now: NOW }).kind, "none");
  assert.equal(getBillingPeriodState({ status: "active", currentPeriodEnd: "", now: NOW }).kind, "none");
  assert.equal(getBillingPeriodState({ status: "active", currentPeriodEnd: "not-a-date", now: NOW }).kind, "none");
  assert.equal(getBillingPeriodState({ status: null, currentPeriodEnd: null, now: NOW }).kind, "none");
  assert.equal(isStaleBillingPeriod({ status: "active", currentPeriodEnd: null, now: NOW }), false);
});

test("statuses render as human labels", () => {
  assert.equal(getSubscriptionStatusLabel("active"), "Active");
  assert.equal(getSubscriptionStatusLabel("past_due"), "Payment overdue");
  assert.equal(getSubscriptionStatusLabel("checkout_pending"), "Awaiting checkout");
  assert.equal(getSubscriptionStatusLabel(null), "Inactive");
  assert.equal(getSubscriptionStatusLabel("some_new_status"), "some new status");
});
