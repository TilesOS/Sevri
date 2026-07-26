"use client";

import * as Sentry from "@sentry/nextjs";
import { sanitizeSentryContext } from "@/lib/sentry/privacy";

export function captureClientError(error: unknown, context?: Record<string, unknown>) {
  const sanitizedContext = sanitizeSentryContext(context);

  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.error("Sentry DSN not configured", {
      errorType: error instanceof Error ? error.name : typeof error,
      ...sanitizedContext,
    });
    return undefined;
  }

  return Sentry.captureException(error, { extra: sanitizedContext });
}
