import { Resend } from "resend";
import { getServerEnv } from "@/lib/env";

const env = getServerEnv();
const resend = new Resend(env.RESEND_API_KEY);

const DEFAULT_FROM = "Sevri <no-reply@sevri.app>";

export async function sendEmail(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({
    from: DEFAULT_FROM,
    to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend email error: ${error.message}`);
  }
}
