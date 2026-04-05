import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/api";
import { syncBillingForUser } from "@/lib/stripe/sync";
import { captureServerError } from "@/lib/sentry/server";

function getRequestedSessionId(body: unknown) {
  if (!body || typeof body !== "object") {
    return null;
  }

  const sessionId = (body as { session_id?: unknown }).session_id;
  return typeof sessionId === "string" && sessionId.trim().length > 0 ? sessionId : null;
}

export async function POST(request: Request) {
  const { user, response } = await requireApiUser();
  if (!user) {
    return response;
  }

  try {
    const requestBody = await request.json().catch(() => null);
    const sessionId = getRequestedSessionId(requestBody);
    const result = await syncBillingForUser(user.id, { checkoutSessionId: sessionId });

    if (result.entitled) {
      return NextResponse.json(
        {
          ...result,
          message: "Billing synced. Sevri Pro is active.",
        },
        { status: 200 },
      );
    }

    return NextResponse.json(
      {
        ...result,
        message: result.synced
          ? `Billing synced, but Stripe still reports the subscription as ${result.status}. Access will update automatically once it becomes active.`
          : "No verified Stripe subscription was found to sync yet.",
      },
      { status: 200 },
    );
  } catch (error) {
    captureServerError(error, { route: "billing/sync" });
    return NextResponse.json({ error: "Failed to sync billing status" }, { status: 500 });
  }
}
