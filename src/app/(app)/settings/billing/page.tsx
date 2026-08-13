import type { Metadata } from "next";
import { BillingActions } from "@/components/billing/billing-actions";
import { BillingReturnSync } from "@/components/billing/billing-return-sync";
import { BillingStaleSync } from "@/components/billing/billing-stale-sync";
import { getPlanLabel } from "@/components/theme/theme-utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { getRequiredStudentUser } from "@/lib/auth/guard";
import { hasVerifiedPlanAccess } from "@/lib/billing/entitlements";
import { getBillingPeriodState, getSubscriptionStatusLabel } from "@/lib/billing/period";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PLAN_LIMITS } from "@/lib/usage/limits";

export const metadata: Metadata = {
  title: "Billing",
};

function getCheckoutState(value: string | undefined) {
  if (value === "success" || value === "cancel") {
    return value;
  }

  return null;
}

function formatPeriodDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function BillingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const user = await getRequiredStudentUser();
  const supabase = await createServerSupabaseClient();
  const resolvedSearchParams = await searchParams;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = subscription?.plan ?? "free";
  const status = subscription?.status ?? "inactive";
  const checkoutState = getCheckoutState(resolvedSearchParams.checkout);
  const sessionId = resolvedSearchParams.session_id ?? null;
  const hasVerifiedAccess = hasVerifiedPlanAccess(plan, status);
  const effectivePlan = hasVerifiedAccess ? plan : "free";
  const isPro = effectivePlan === "pro_monthly";
  const periodState = getBillingPeriodState({
    status,
    currentPeriodEnd: subscription?.current_period_end ?? null,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Billing"
        description={
          isPro
            ? "Your plan, renewal date, and payment details — all managed through Stripe."
            : `Start free, explore up to ${PLAN_LIMITS.free.generation_limit} idea boards, and upgrade when you want deeper coaching.`
        }
      />
      <SettingsNav />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-5" tone="blush" elevation="soft">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={isPro ? "accent" : "neutral"}>{getPlanLabel(effectivePlan)}</Badge>
            <Badge tone={status === "active" || status === "trialing" ? "success" : "warning"}>
              {getSubscriptionStatusLabel(status)}
            </Badge>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold text-ink">
              {isPro ? "Sevri Pro is active." : "You are currently on the free plan."}
            </h2>
            <p className="text-sm leading-6 text-ink-soft">
              {isPro
                ? "You have unlimited idea board generations, subject to fair-use and rate limits, plus detailed step coaching and evaluation while the project evolves."
                : `The free tier is perfect for validating the workflow. You can explore up to ${PLAN_LIMITS.free.generation_limit} idea boards in any field, build the roadmap, and upgrade when you want deeper coaching.`}
            </p>
          </div>

          <BillingReturnSync checkoutState={checkoutState} sessionId={sessionId} isEntitled={hasVerifiedAccess} />

          {periodState.kind === "stale" ? <BillingStaleSync periodEnd={periodState.endsAt} /> : null}

          {periodState.kind === "renews" ? (
            <p className="text-sm text-ink-soft">Renews on {formatPeriodDate(periodState.endsAt)}</p>
          ) : null}

          {periodState.kind === "trial_ends" ? (
            <p className="text-sm text-ink-soft">Trial ends on {formatPeriodDate(periodState.endsAt)}</p>
          ) : null}

          {periodState.kind === "payment_issue" ? (
            <p className="text-sm text-ink-soft">
              Your last payment did not go through. Update your card in the billing portal to keep Sevri Pro.
            </p>
          ) : null}

          <BillingActions canManageBilling={Boolean(subscription?.stripe_customer_id)} />
        </Card>

        {isPro ? (
          <Card className="space-y-4" tone="butter" elevation="soft">
            <p className="text-xs font-medium text-ink-muted">Your plan</p>
            <h2 className="text-lg font-semibold text-ink">What Sevri Pro covers.</h2>
            <ul className="space-y-3 text-sm leading-6 text-ink-soft">
              <li>Unlimited idea boards, subject to fair-use and rate limits.</li>
              <li>Step-by-step coaching, evaluation, and reviewer feedback across every roadmap step.</li>
              <li>Portfolio packaging: résumé bullets, Common App drafts, calendar export, and public project pages.</li>
            </ul>
            <p className="text-sm leading-6 text-ink-soft">
              Use <span className="font-semibold text-ink">Manage subscription</span> to update your payment method,
              download invoices, or cancel. Cancelling keeps Pro until the end of the period you have paid for.
            </p>
          </Card>
        ) : (
          <Card className="space-y-4" tone="butter" elevation="soft">
            <p className="text-xs font-medium text-ink-muted">Why upgrade</p>
            <h2 className="text-lg font-semibold text-ink">Upgrade for better coaching, not more noise.</h2>
            <ul className="space-y-3 text-sm leading-6 text-ink-soft">
              <li>Generate fresh idea boards whenever your understanding of the right project changes.</li>
              <li>Unlock detailed step guidance and AI evaluation while the roadmap is unfolding.</li>
              <li>Use Pro when the direction is chosen and execution matters more than experimentation.</li>
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
