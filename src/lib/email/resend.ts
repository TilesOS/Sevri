import { Resend } from "resend";
import { getEmailEnv } from "@/lib/env";
import type { EmailSender, EmailTemplate } from "@/lib/email/types";

const FROM: Record<EmailSender, string> = {
  hello: "Sevri <hello@sevri.co>",
  coach: "Sevri Coach <coach@sevri.co>",
};

export async function sendEmail(args: {
  to: string;
  sender: EmailSender;
  template: EmailTemplate;
  replyTo?: string;
  unsubscribeUrl?: string;
  idempotencyKey?: string;
  tags?: Array<{ name: string; value: string }>;
}) {
  const resend = new Resend(getEmailEnv().RESEND_API_KEY);
  const headers = args.unsubscribeUrl
    ? {
        "List-Unsubscribe": `<${args.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      }
    : undefined;
  const { data, error } = await resend.emails.send(
    {
      from: FROM[args.sender],
      to: args.to,
      subject: args.template.subject,
      html: args.template.html,
      text: args.template.text,
      replyTo: args.replyTo ?? (args.sender === "coach" ? "coach@sevri.co" : "hello@sevri.co"),
      headers,
      tags: args.tags,
    },
    args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
  );

  if (error || !data?.id) {
    throw new Error(`Resend email error: ${error?.message ?? "missing provider id"}`);
  }

  return { id: data.id };
}
