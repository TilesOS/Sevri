import { getRequiredUser } from "@/lib/auth/guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-6">
      <Card className="space-y-3">
        <h1 className="text-2xl font-bold text-ink-900">Billing</h1>
        <p className="text-sm text-ink-700">Manage your plan and unlock premium roadmap features.</p>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge>{plan === "pro_monthly" ? "Pro" : "Free"}</Badge>
          <Badge className="bg-ink-100 text-ink-700">{status}</Badge>
        </div>

        {subscription?.current_period_end ? (
          <p className="text-sm text-ink-600">
            Current period ends: {new Date(subscription.current_period_end).toLocaleDateString()}
          </p>
        ) : null}

        <BillingActions hasSubscription={Boolean(subscription?.status && subscription.status !== "inactive")} />
      </Card>
    </div>
  );
}