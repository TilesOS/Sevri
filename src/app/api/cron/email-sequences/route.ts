import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getLifecycleEmailReadiness } from "@/lib/env";
import { dispatchDueEmailMessages } from "@/lib/email/outbox";
import { planLifecycleEmails } from "@/lib/email/planner";
import { captureServerError } from "@/lib/sentry/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  const readiness = getLifecycleEmailReadiness();
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authorized(request, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const planned = readiness.ready ? await planLifecycleEmails() : { activation: 0, coach: 0, errors: 0 };
    const delivered = await dispatchDueEmailMessages(50);
    return NextResponse.json({
      ok: true,
      lifecycle_ready: readiness.ready,
      ...(readiness.ready ? {} : { missing: readiness.missing }),
      planned,
      delivered,
    });
  } catch (error) {
    captureServerError(error, { route: "cron/email-sequences" });
    return NextResponse.json({ error: "Email sequence run failed" }, { status: 500 });
  }
}
