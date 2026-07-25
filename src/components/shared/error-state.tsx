"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

interface ErrorStateProps {
  eyebrow?: string;
  title: string;
  description: string;
  /** Next.js error digest, shown so a student can quote it to support. */
  digest?: string;
  onRetry?: () => void;
  retryLabel?: string;
  backHref?: string;
  backLabel?: string;
  children?: ReactNode;
}

/**
 * Shared branded fallback for route error boundaries. Focus moves to the
 * heading on mount so keyboard and screen-reader users land on the explanation
 * rather than staying on a control that no longer exists.
 */
export function ErrorState({
  eyebrow = "Something went wrong",
  title,
  description,
  digest,
  onRetry,
  retryLabel = "Try again",
  backHref,
  backLabel = "Go back",
  children,
}: ErrorStateProps) {
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <Card padding="lg" className="space-y-6">
      <div ref={headingRef} tabIndex={-1}>
        <PageHeader eyebrow={eyebrow} title={title} description={description} className="border-b-0 pb-0" />
      </div>

      {children}

      <div className="flex flex-wrap gap-3">
        {onRetry ? (
          <Button type="button" size="lg" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
        {backHref ? (
          <Button href={backHref} size="lg" variant="outline">
            {backLabel}
          </Button>
        ) : null}
      </div>

      {digest ? (
        <p className="text-xs text-ink-muted">
          Reference code <code className="font-semibold text-ink-soft">{digest}</code> — include it if you contact
          support.
        </p>
      ) : null}
    </Card>
  );
}
