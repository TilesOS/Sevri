import { getRequiredUser } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getPlanLabel } from "@/components/theme/theme-utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { BillingActions } from "@/components/billing/billing-actions";

export default async function BillingPage() {
  const user = await getRequiredUser();
  const supabase = await createServerSupabaseClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  const plan = subscription?.plan ?? "free";
  const status = subscription?.status ?? "inactive";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Manage the depth of your workspace."
        description="Start free, upgrade when you want more iteration room, and manage your billing details without disrupting your project flow."
      />

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={plan === "pro_monthly" ? "accent" : "neutral"}>{getPlanLabel(plan)}</Badge>
            <Badge tone={status === "active" ? "success" : "warning"}>{status}</Badge>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold text-ink">
              {plan === "pro_monthly" ? "Sevri Pro is active." : "You are currently on the free plan."}
            </h2>
            <p className="text-sm leading-6 text-ink-soft">
              {plan === "pro_monthly"
                ? "You have more room to iterate on recommendation boards and stay in the premium workspace while the project evolves."
                : "The free tier is perfect for validating the workflow. Upgrade when you want more depth and more refreshes."}
            </p>
          </div>

          {subscription?.current_period_end ? (
            <p className="text-sm text-ink-soft">
              Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}
            </p>
          ) : null}

          <BillingActions hasSubscription={Boolean(subscription?.status && subscription.status !== "inactive")} />
        </Card>

        <Card tone="blush" className="space-y-4">
          <p className="editorial-kicker">Why upgrade</p>
          <h2 className="text-3xl font-semibold text-ink">Upgrade for better iteration, not more noise.</h2>
          <ul className="space-y-3 text-sm leading-6 text-ink-soft">
            <li>Refresh recommendation boards when your understanding of the right project changes.</li>
            <li>Keep more momentum inside the workspace while the roadmap is unfolding.</li>
            <li>Use Pro when the direction is chosen and execution matters more than experimentation.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
