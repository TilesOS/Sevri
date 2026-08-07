import { clientEnv, getLifecycleEmailReadiness } from "@/lib/env";
import { captureServerError } from "@/lib/sentry/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/resend";
import {
  activationEmailTemplate,
  coachEmailTemplate,
  roadmapReadyTemplate,
  welcomeEmailTemplate,
} from "@/lib/email/templates";
import { createUnsubscribeToken } from "@/lib/email/unsubscribe";
import { isOptionalMessageType, type EmailMessageType, type EmailSender } from "@/lib/email/types";

export interface QueuedEmailMessage {
  id: string;
  user_id: string;
  project_id: string | null;
  intake_id: string | null;
  message_type: EmailMessageType;
  dedupe_key: string;
  to_email: string;
  from_alias: EmailSender;
  payload_json: Record<string, unknown>;
  status: string;
  attempt_count: number;
}

export async function enqueueEmailMessage(args: {
  userId: string;
  projectId?: string | null;
  intakeId?: string | null;
  messageType: EmailMessageType;
  dedupeKey: string;
  toEmail: string;
  sender: EmailSender;
  payload?: Record<string, unknown>;
  scheduledFor?: string;
}) {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("email_messages")
    .insert({
      user_id: args.userId,
      project_id: args.projectId ?? null,
      intake_id: args.intakeId ?? null,
      message_type: args.messageType,
      dedupe_key: args.dedupeKey,
      to_email: args.toEmail,
      from_alias: args.sender,
      payload_json: args.payload ?? {},
      scheduled_for: args.scheduledFor ?? now,
      next_attempt_at: args.scheduledFor ?? now,
    })
    .select("*")
    .single();

  if (!error && data) return data as QueuedEmailMessage;
  if (error?.code !== "23505") {
    throw new Error(`Failed to enqueue email: ${error?.message ?? "unknown"}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("email_messages")
    .select("*")
    .eq("dedupe_key", args.dedupeKey)
    .single();
  if (existingError || !existing) {
    throw new Error(`Failed to load queued email: ${existingError?.message ?? "unknown"}`);
  }
  return existing as QueuedEmailMessage;
}

function stringValue(payload: Record<string, unknown>, key: string) {
  return typeof payload[key] === "string" ? payload[key] as string : "";
}

function renderMessage(message: QueuedEmailMessage) {
  const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const payload = message.payload_json ?? {};
  if (message.message_type === "welcome") {
    return { template: welcomeEmailTemplate(stringValue(payload, "fullName"), siteUrl) };
  }
  if (message.message_type === "roadmap_ready") {
    return {
      template: roadmapReadyTemplate(
        stringValue(payload, "projectTitle"),
        siteUrl,
        message.project_id ?? stringValue(payload, "projectId"),
      ),
    };
  }

  const readiness = getLifecycleEmailReadiness();
  if (!readiness.ready) return null;
  const token = createUnsubscribeToken(message.user_id);
  const unsubscribeUrl = `${siteUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
  const footer = { postalAddress: readiness.env.EMAIL_POSTAL_ADDRESS, unsubscribeUrl };

  if (message.message_type === "activation_day_3" || message.message_type === "activation_day_7") {
    return {
      template: activationEmailTemplate({
        day: message.message_type === "activation_day_3" ? 3 : 7,
        siteUrl,
        footer,
      }),
      unsubscribeUrl,
    };
  }

  return {
    template: coachEmailTemplate({
      day: message.message_type === "coach_inactive_7" ? 7 : 14,
      projectTitle: stringValue(payload, "projectTitle"),
      projectId: message.project_id ?? stringValue(payload, "projectId"),
      stepTitle: stringValue(payload, "stepTitle") || null,
      curatedSubject: stringValue(payload, "curatedSubject") || null,
      curatedBody: stringValue(payload, "curatedBody") || null,
      siteUrl,
      footer,
    }),
    unsubscribeUrl,
  };
}

async function canSendMessage(message: QueuedEmailMessage) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("email_preferences")
    .select("lifecycle_enabled, delivery_suppressed_at")
    .eq("user_id", message.user_id)
    .maybeSingle();
  if (error) throw new Error(`Failed to validate email preference: ${error.message}`);
  if (data?.delivery_suppressed_at) return false;
  if (!isOptionalMessageType(message.message_type)) return true;
  if (!getLifecycleEmailReadiness().ready) return false;
  return Boolean(data?.lifecycle_enabled);
}

async function deliverClaimedMessage(message: QueuedEmailMessage) {
  const supabase = createAdminSupabaseClient();
  try {
    if (!(await canSendMessage(message))) {
      await supabase.from("email_messages").update({ status: "canceled", last_error: null }).eq("id", message.id);
      return "canceled" as const;
    }
    const rendered = renderMessage(message);
    if (!rendered) {
      await supabase.from("email_messages").update({ status: "canceled" }).eq("id", message.id);
      return "canceled" as const;
    }
    const result = await sendEmail({
      to: message.to_email,
      sender: message.from_alias,
      template: rendered.template,
      unsubscribeUrl: rendered.unsubscribeUrl,
      idempotencyKey: message.id,
      tags: [{ name: "message_type", value: message.message_type }],
    });
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("email_messages")
      .update({ status: "sent", provider_email_id: result.id, sent_at: now, last_error: null })
      .eq("id", message.id);
    if (error) throw new Error(`Failed to record sent email: ${error.message}`);
    return "sent" as const;
  } catch (error) {
    const delayMinutes = message.attempt_count <= 1 ? 5 : message.attempt_count === 2 ? 60 : 24 * 60;
    const nextAttemptAt = new Date(Date.now() + delayMinutes * 60_000).toISOString();
    await supabase
      .from("email_messages")
      .update({
        status: "failed",
        next_attempt_at: nextAttemptAt,
        last_error: (error instanceof Error ? error.message : "Unknown delivery error").slice(0, 500),
      })
      .eq("id", message.id);
    captureServerError(error, { stage: "email_delivery", message_type: message.message_type, message_id: message.id });
    return "failed" as const;
  }
}

export async function dispatchEmailMessageNow(messageId: string) {
  const supabase = createAdminSupabaseClient();
  const { data: current, error: loadError } = await supabase
    .from("email_messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();
  if (loadError) throw new Error(`Failed to load email: ${loadError.message}`);
  if (!current || !["pending", "failed"].includes(current.status) || current.attempt_count >= 3) return null;

  const { data, error } = await supabase
    .from("email_messages")
    .update({ status: "processing", attempt_count: current.attempt_count + 1, last_error: null })
    .eq("id", messageId)
    .in("status", ["pending", "failed"])
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Failed to claim email: ${error.message}`);
  return data ? deliverClaimedMessage(data as QueuedEmailMessage) : null;
}

export async function dispatchDueEmailMessages(limit = 25) {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("claim_email_messages", { p_limit: limit });
  if (error) throw new Error(`Failed to claim due email: ${error.message}`);
  const results = await Promise.all(
    ((data ?? []) as QueuedEmailMessage[]).map((row) => deliverClaimedMessage(row)),
  );
  return {
    claimed: results.length,
    sent: results.filter((result) => result === "sent").length,
    failed: results.filter((result) => result === "failed").length,
    canceled: results.filter((result) => result === "canceled").length,
  };
}

export async function enqueueAndDispatchEmail(args: Parameters<typeof enqueueEmailMessage>[0]) {
  const message = await enqueueEmailMessage(args);
  await dispatchEmailMessageNow(message.id);
  return message;
}
