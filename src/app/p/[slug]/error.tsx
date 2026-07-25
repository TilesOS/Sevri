"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { captureClientError } from "@/lib/sentry/client";

export default function PublicPortfolioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientError(error, { surface: "public_portfolio_page", digest: error.digest });
  }, [error]);

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <ErrorState
          eyebrow="Sevri"
          title="This project page didn't load."
          description="Something went wrong on our side. Try again in a moment."
          digest={error.digest}
          onRetry={reset}
          retryLabel="Try again"
          backHref="/"
          backLabel="What is Sevri?"
        />
      </div>
    </main>
  );
}
