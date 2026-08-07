import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { getEmailWebhookEnv } from "@/lib/env";
import { suppressLifecycleEmail } from "@/lib/email/preferences";
import { captureServerError } from "@/lib/sentry/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: { email_id?: string };
}

const STATUS_BY_EVENT: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.failed": "failed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
};

async function markProcessed(eventId: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("email_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider_event_id", eventId);
  if (error) throw new Error(`Failed to mark webhook processed: ${error.message}`);
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  let event: ResendWebhookEvent;
  try {
    event = new Webhook(getEmailWebhookEnv().RESEND_WEBHOOK_SECRET).verify(rawBody, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    }) as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const eventId = request.headers.get("svix-id");
  const providerEmailId = event.data?.email_id ?? null;
  if (!eventId || !event.type || !event.created_at) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { error: insertError } = await supabase.from("email_webhook_events").insert({
    provider_event_id: eventId,
    provider_email_id: providerEmailId,
    event_type: event.type,
    occurred_at: event.created_at,
  });
  if (insertError?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("email_webhook_events")
      .select("processed_at")
      .eq("provider_event_id", eventId)
      .single();
    if (existingError) {
      captureServerError(existingError, { route: "email/webhook", stage: "dedupe_lookup" });
      return NextResponse.json({ error: "Webhook persistence failed" }, { status: 500 });
    }
    if (existing.processed_at) return NextResponse.json({ ok: true, duplicate: true });
  }
  if (insertError) {
    if (insertError.code !== "23505") {
      captureServerError(insertError, { route: "email/webhook", stage: "dedupe" });
      return NextResponse.json({ error: "Webhook persistence failed" }, { status: 500 });
    }
  }

  const status = STATUS_BY_EVENT[event.type];
  if (!status || !providerEmailId) {
    try {
      await markProcessed(eventId);
      return NextResponse.json({ ok: true });
    } catch (error) {
      captureServerError(error, { route: "email/webhook", stage: "mark_processed" });
      return NextResponse.json({ error: "Webhook persistence failed" }, { status: 500 });
    }
  }
  const { data: message, error: messageError } = await supabase
    .from("email_messages")
    .select("id, user_id, last_event_at")
    .eq("provider_email_id", providerEmailId)
    .maybeSingle();
  if (messageError) {
    captureServerError(messageError, { route: "email/webhook", stage: "message_lookup" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
  if (!message) {
    return NextResponse.json({ error: "Email message not ready", unmatched: true }, { status: 503 });
  }
  if (message.last_event_at && new Date(message.last_event_at) > new Date(event.created_at)) {
    try {
      await markProcessed(eventId);
      return NextResponse.json({ ok: true, stale: true });
    } catch (error) {
      captureServerError(error, { route: "email/webhook", stage: "mark_processed" });
      return NextResponse.json({ error: "Webhook persistence failed" }, { status: 500 });
    }
  }

  const { error: updateError } = await supabase
    .from("email_messages")
    .update({ status, last_event_at: event.created_at })
    .eq("id", message.id);
  if (updateError) {
    captureServerError(updateError, { route: "email/webhook", stage: "message_update" });
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
  if (["bounced", "complained", "suppressed"].includes(status)) {
    try {
      await suppressLifecycleEmail(message.user_id, status);
    } catch (error) {
      captureServerError(error, { route: "email/webhook", stage: "recipient_suppression" });
      return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
    }
  }
  try {
    await markProcessed(eventId);
  } catch (error) {
    captureServerError(error, { route: "email/webhook", stage: "mark_processed" });
    return NextResponse.json({ error: "Webhook persistence failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
