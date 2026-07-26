import * as Sentry from "@sentry/nextjs";
import { sentryPrivacyOptions } from "@/lib/sentry/options";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  replaysOnErrorSampleRate: 0,
  replaysSessionSampleRate: 0,
  ...sentryPrivacyOptions,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
