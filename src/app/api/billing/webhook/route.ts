import { NextResponse } from "next/server";
import { constructStripeEvent, processStripeEvent } from "@/lib/stripe/webhook";
import { captureServerError } from "@/lib/sentry/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    const body = await request.text();
    const event = constructStripeEvent(body, signature);

    await processStripeEvent(event);

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "billing/webhook" });
    return NextResponse.json({ error: "Webhook failed" }, { status: 400 });
  }
}