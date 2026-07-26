import * as Sentry from "@sentry/nextjs";
import { sanitizeSentryContext } from "@/lib/sentry/privacy";
import { getServerSentryDsn } from "@/lib/sentry/server-dsn";

export function captureServerError(error: unknown, context?: Record<string, unknown>) {
  const sanitizedContext = sanitizeSentryContext(context);

  if (!getServerSentryDsn()) {
    console.error("Sentry DSN not configured", {
      errorType: error instanceof Error ? error.name : typeof error,
      ...sanitizedContext,
    });
    return undefined;
  }

  return Sentry.captureException(error, { extra: sanitizedContext });
}
