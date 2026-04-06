import { getRequiredUser } from "@/lib/auth/guard";
import { hasVerifiedPlanAccess } from "@/lib/billing/entitlements";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BillingReturnSync } from "@/components/billing/billing-return-sync";
import { getPlanLabel } from "@/components/theme/theme-utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BillingActions } from "@/components/billing/billing-actions";

function getCheckoutState(value: string | undefined) {
  if (value === "success" || value === "cancel") {
    return value;
  }

  return null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; session_id?: string }>;
}) {
  const user = await getRequiredUser();
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Manage the depth of your workspace."
        description="Start free, upgrade when you want unlimited generations and deeper coaching, and manage your billing details without disrupting your project flow."
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={effectivePlan === "pro_monthly" ? "accent" : "neutral"}>{getPlanLabel(effectivePlan)}</Badge>
            <Badge tone={status === "active" ? "success" : "warning"}>{status}</Badge>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold text-ink">
              {effectivePlan === "pro_monthly" ? "Sevri Pro is active." : "You are currently on the free plan."}
            </h2>
            <p className="text-sm leading-6 text-ink-soft">
              {effectivePlan === "pro_monthly"
                ? "You have unlimited generations plus detailed step coaching and evaluation while the project evolves."
                : "The free tier is perfect for validating the workflow. You can use two generations total, build the roadmap, and upgrade when you want deeper coaching."}
            </p>
          </div>

          <BillingReturnSync checkoutState={checkoutState} sessionId={sessionId} isEntitled={hasVerifiedAccess} />

          {subscription?.current_period_end ? (
            <p className="text-sm text-ink-soft">
              Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          ) : null}

          <BillingActions canManageBilling={Boolean(subscription?.stripe_customer_id)} />
        </Card>

        <Card tone="blush" className="space-y-4">
          <p className="editorial-kicker">Why upgrade</p>
          <h2 className="text-3xl font-semibold text-ink">Upgrade for better coaching, not more noise.</h2>
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            <li>Generate fresh recommendation boards whenever your understanding of the right project changes.</li>
            <li>Unlock detailed step guidance and AI evaluation while the roadmap is unfolding.</li>
            <li>Use Pro when the direction is chosen and execution matters more than experimentation.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
