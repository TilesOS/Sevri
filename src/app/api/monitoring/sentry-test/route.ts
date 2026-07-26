import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { captureServerError } from "@/lib/sentry/server";
import { getServerSentryDsn } from "@/lib/sentry/server-dsn";

export const runtime = "nodejs";

function tokensMatch(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) {
    return false;
  }

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  if (process.env.SENTRY_TEST_ROUTE_ENABLED !== "true") {
    return new Response(null, { status: 404 });
  }

  if (!tokensMatch(request.headers.get("x-sentry-test-token"), process.env.SENTRY_TEST_ROUTE_TOKEN)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getServerSentryDsn()) {
    return Response.json({ error: "Sentry DSN is not configured" }, { status: 503 });
  }

  const eventId = captureServerError(new Error("Controlled Sentry monitoring test"), {
    mechanism: "controlled_test",
    route: "monitoring/sentry-test",
  });

  await Sentry.flush(2_000);

  return Response.json({ eventId });
}
