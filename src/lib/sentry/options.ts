import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/sentry/privacy";

export const sentryPrivacyOptions = {
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeBreadcrumb: scrubSentryBreadcrumb,
  beforeSend: scrubSentryEvent,
};
