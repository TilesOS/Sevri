/**
 * Re-sync subscription rows from Stripe.
 *
 * Usage:
 *   npm run billing:reconcile                 # report drift, change nothing
 *   npm run billing:reconcile -- --apply      # re-sync every drifted row
 *   npm run billing:reconcile -- --apply --user-id <uuid>
 *   npm run billing:reconcile -- --apply --all
 *
 * Without --apply nothing is written. By default only rows whose stored state
 * looks wrong are re-synced (an entitled status whose period has elapsed, or a
 * row that has a Stripe subscription id but no period at all); --all re-syncs
 * every row that has something to sync against.
 */

import { isStaleBillingPeriod } from "../src/lib/billing/period";
import { createAdminSupabaseClient } from "../src/lib/supabase/admin";
import { syncBillingForUser } from "../src/lib/stripe/sync";

interface SubscriptionRow {
  user_id: string;
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

function parseArgs(argv: string[]) {
  const userIdIndex = argv.indexOf("--user-id");

  return {
    apply: argv.includes("--apply"),
    all: argv.includes("--all"),
    userId: userIdIndex >= 0 ? argv[userIdIndex + 1] ?? null : null,
  };
}

function needsReconciliation(row: SubscriptionRow) {
  if (isStaleBillingPeriod({ status: row.status, currentPeriodEnd: row.current_period_end })) {
    return "period_elapsed";
  }

  if (row.stripe_subscription_id && !row.current_period_end) {
    return "missing_period";
  }

  return null;
}

async function loadRows(userId: string | null): Promise<SubscriptionRow[]> {
  const supabase = createAdminSupabaseClient();
  const query = supabase
    .from("subscriptions")
    .select("user_id, plan, status, current_period_end, stripe_customer_id, stripe_subscription_id");

  const { data, error } = userId ? await query.eq("user_id", userId) : await query;

  if (error) {
    throw new Error(`Failed to load subscriptions: ${error.message}`);
  }

  return (data ?? []) as SubscriptionRow[];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = await loadRows(args.userId);

  const targets = rows.filter((row) => {
    if (args.all) {
      return Boolean(row.stripe_subscription_id || row.stripe_customer_id);
    }
    return needsReconciliation(row) !== null;
  });

  console.log(`Loaded ${rows.length} subscription row(s); ${targets.length} need attention.`);

  if (targets.length === 0) {
    return;
  }

  if (!args.apply) {
    for (const row of targets) {
      console.log(
        `[dry-run] ${row.user_id} plan=${row.plan} status=${row.status} period_end=${row.current_period_end ?? "none"} reason=${
          needsReconciliation(row) ?? "forced"
        }`,
      );
    }
    console.log("\nNothing was written. Re-run with --apply to reconcile.");
    return;
  }

  let reconciled = 0;
  let failed = 0;

  for (const row of targets) {
    try {
      const result = await syncBillingForUser(row.user_id);
      reconciled += 1;
      console.log(
        `[synced] ${row.user_id} source=${result.source} status=${result.status} period_end=${
          result.currentPeriodEnd ?? "none"
        } entitled=${result.entitled}`,
      );
    } catch (error) {
      failed += 1;
      console.error(`[failed] ${row.user_id}`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\nReconciled ${reconciled} row(s); ${failed} failed.`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
