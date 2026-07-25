"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { Section } from "@/components/ui/section";
import { captureClientError } from "@/lib/sentry/client";

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientError(error, { surface: "marketing_route", digest: error.digest });
  }, [error]);

  return (
    <Section className="pt-14 sm:pt-20">
      <div className="mx-auto max-w-2xl">
        <ErrorState
          eyebrow="Something went wrong"
          title="This page didn't load."
          description="That's on us, not on you. Try again, or head to the homepage."
          digest={error.digest}
          onRetry={reset}
          retryLabel="Try again"
          backHref="/"
          backLabel="Go to the homepage"
        />
      </div>
    </Section>
  );
}
