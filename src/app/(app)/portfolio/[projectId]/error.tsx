"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { captureClientError } from "@/lib/sentry/client";

export default function PortfolioEntryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientError(error, {
      surface: "portfolio_entry_detail",
      digest: error.digest,
    });
  }, [error]);

  return (
    <ErrorState
      eyebrow="Portfolio entry"
      title="We couldn't open this entry."
      description="Your project, submissions, and reflection are safe — only this page failed to load. Try again, or head back to your portfolio and open it from there."
      digest={error.digest}
      onRetry={reset}
      retryLabel="Try again"
      backHref="/portfolio"
      backLabel="Back to portfolio"
    />
  );
}
