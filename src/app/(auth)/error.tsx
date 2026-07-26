"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { captureClientError } from "@/lib/sentry/client";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientError(error, { surface: "auth_route", digest: error.digest });
  }, [error]);

  return (
    <ErrorState
      eyebrow="Something went wrong"
      title="We couldn't load that form."
      description="No sign-in attempt was made and nothing was changed on your account. Try again, or start from the homepage."
      digest={error.digest}
      onRetry={reset}
      retryLabel="Try again"
      backHref="/"
      backLabel="Go to the homepage"
    />
  );
}
