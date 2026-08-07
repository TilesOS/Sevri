export type EmailSender = "hello" | "coach";

export type EmailMessageType =
  | "welcome"
  | "activation_day_3"
  | "activation_day_7"
  | "roadmap_ready"
  | "coach_inactive_7"
  | "coach_inactive_14";

export interface EmailTemplate {
  subject: string;
  preview: string;
  html: string;
  text: string;
}

export const OPTIONAL_MESSAGE_TYPES = new Set<EmailMessageType>([
  "activation_day_3",
  "activation_day_7",
  "coach_inactive_7",
  "coach_inactive_14",
]);

export function isOptionalMessageType(value: EmailMessageType) {
  return OPTIONAL_MESSAGE_TYPES.has(value);
}
