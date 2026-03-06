import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { createPortalSession } from "@/lib/stripe/checkout";
import { captureServerError } from "@/lib/sentry/server";

export async function POST() {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const session = await createPortalSession(user.id);

    return NextResponse.json({ url: session.url }, { status: 200 });
  } catch (error) {
    captureServerError(error, { route: "billing/portal" });
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}