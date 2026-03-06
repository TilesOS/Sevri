import * as Sentry from "@sentry/nextjs";

export function captureServerError(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.SENTRY_DSN) {
    console.error("Sentry DSN not configured", error, context);
    return;
  }

  Sentry.captureException(error, { extra: context });
}