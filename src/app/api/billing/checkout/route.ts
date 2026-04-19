import { NextResponse } from "next/server";
import { requireApiStudent } from "@/lib/auth/api";
import { createCheckoutSession } from "@/lib/stripe/checkout";
import { trackEvent } from "@/lib/analytics/track";
import { captureServerError } from "@/lib/sentry/server";

export async function POST() {
  const { user, response } = await requireApiStudent();
  if (!user) {
    return response;
  }

  try {
    await trackEvent(user.id, "upgrade_clicked", { source: "billing_page" });
    const session = await createCheckoutSession(user.id, user.email);

    if (!session.url) {
      return NextResponse.json({ error: "Stripe checkout URL missing" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "billing/checkout" });
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
