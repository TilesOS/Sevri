"use client";

import * as Sentry from "@sentry/nextjs";

export function captureClientError(error: unknown, context?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN && !process.env.SENTRY_DSN) {
    console.error("Sentry DSN not configured", error, context);
    return;
  }

  Sentry.captureException(error, { extra: context });
}