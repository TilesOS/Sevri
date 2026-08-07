import { NextResponse } from "next/server";
import { setLifecycleEmailPreference } from "@/lib/email/preferences";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { captureServerError } from "@/lib/sentry/server";

function html(body: string, status = 200) {
  return new NextResponse(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Email preferences</title></head><body style="font-family:system-ui;max-width:560px;margin:64px auto;padding:0 24px;color:#0f172a;">${body}</body></html>`, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!verifyUnsubscribeToken(token)) return html("<h1>This link is invalid or incomplete.</h1>", 400);
  return html("<h1>Stop coaching emails?</h1><p>You will still receive essential account and project-service messages.</p><form method=\"post\"><button style=\"padding:12px 18px;border:0;border-radius:8px;background:#0f172a;color:white;font-weight:600;\" type=\"submit\">Unsubscribe</button></form>");
}

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return html("<h1>This link is invalid or incomplete.</h1>", 400);
  try {
    await setLifecycleEmailPreference(userId, false);
    return html("<h1>You’re unsubscribed.</h1><p>Sevri will no longer send activation or coaching reminders. You can turn them back on in Settings.</p>");
  } catch (error) {
    captureServerError(error, { route: "email/unsubscribe" });
    return html("<h1>We couldn’t update that preference.</h1><p>Please try again or contact support@sevri.co.</p>", 500);
  }
}
