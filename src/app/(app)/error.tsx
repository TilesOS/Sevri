"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { captureClientError } from "@/lib/sentry/client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientError(error, { surface: "app_route", digest: error.digest });
  }, [error]);

  return (
    <ErrorState
      eyebrow="Something went wrong"
      title="This page didn't load."
      description="Your projects, steps, and submitted work are all saved — only this screen failed. Try again, or head back to your dashboard and open it from there."
      digest={error.digest}
      onRetry={reset}
      retryLabel="Try again"
      backHref="/dashboard"
      backLabel="Back to dashboard"
    />
  );
}
