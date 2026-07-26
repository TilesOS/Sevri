import * as Sentry from "@sentry/nextjs";
import { sentryPrivacyOptions } from "@/lib/sentry/options";
import { getServerSentryDsn } from "@/lib/sentry/server-dsn";

const dsn = getServerSentryDsn();

Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  ...sentryPrivacyOptions,
});
