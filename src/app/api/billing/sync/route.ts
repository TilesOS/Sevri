import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { syncBillingForUser } from "@/lib/stripe/sync";
import { captureServerError } from "@/lib/sentry/server";

export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const result = await syncBillingForUser(user.id);

    if (result.synced) {
      return NextResponse.json(
        {
          ...result,
          message: `Billing synced. Current plan: ${result.plan === "pro_monthly" ? "Pro" : "Free"}.`,
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ...result,
        message: "No active Stripe subscription was found to sync yet.",
      },
      { status: 200 },
    );
  } catch (error) {
    captureServerError(error, { route: "billing/sync" });
    return NextResponse.json({ error: "Failed to sync billing status" }, { status: 500 });
  }
}
