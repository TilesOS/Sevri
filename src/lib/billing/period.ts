// How a subscription's paid-through date should be described.
//
// One number per fact: an active subscription shows exactly one date, phrased as
// a renewal. A date that has already passed while the row still reads "active"
// means our copy of Stripe's state is behind — that is reported as `stale` so the
// UI can re-sync instead of showing a date the student can see is wrong.

export type BillingPeriodState =
  | { kind: "renews"; endsAt: string }
  | { kind: "trial_ends"; endsAt: string }
  | { kind: "stale"; endsAt: string }
  | { kind: "payment_issue" }
  | { kind: "none" };

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getBillingPeriodState(input: {
  status: string | null | undefined;
  currentPeriodEnd: string | null | undefined;
  now?: number;
}): BillingPeriodState {
  const now = input.now ?? Date.now();
  const status = input.status ?? "inactive";

  if (status === "past_due" || status === "unpaid") {
    return { kind: "payment_issue" };
  }

  if (status !== "active" && status !== "trialing") {
    return { kind: "none" };
  }

  const endsAt = parseTimestamp(input.currentPeriodEnd);
  if (endsAt === null) {
    return { kind: "none" };
  }

  const endsAtIso = new Date(endsAt).toISOString();
  if (endsAt <= now) {
    return { kind: "stale", endsAt: endsAtIso };
  }

  return status === "trialing"
    ? { kind: "trial_ends", endsAt: endsAtIso }
    : { kind: "renews", endsAt: endsAtIso };
}

/** True when an entitled subscription's stored period has already elapsed. */
export function isStaleBillingPeriod(input: {
  status: string | null | undefined;
  currentPeriodEnd: string | null | undefined;
  now?: number;
}): boolean {
  return getBillingPeriodState(input).kind === "stale";
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment overdue",
  unpaid: "Payment overdue",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  paused: "Paused",
  checkout_pending: "Awaiting checkout",
  checkout_completed: "Confirming",
  inactive: "Inactive",
};

export function getSubscriptionStatusLabel(status: string | null | undefined): string {
  if (!status) {
    return STATUS_LABELS.inactive;
  }

  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}
