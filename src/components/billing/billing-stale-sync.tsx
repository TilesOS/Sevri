"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { isStaleBillingPeriod } from "@/lib/billing/period";

type SyncPhase = "syncing" | "unresolved" | "failed";

interface SyncResponseBody {
  synced?: boolean;
  status?: string;
  currentPeriodEnd?: string | null;
}

const MAX_AUTOMATIC_ATTEMPTS = 2;

/**
 * Rendered only when the stored subscription says "active" but its period has
 * already elapsed. Rather than showing a date the student can see is wrong, the
 * page re-syncs from Stripe and refreshes itself; if Stripe still reports a past
 * period, that is stated plainly instead of being retried forever.
 */
export function BillingStaleSync({ periodEnd }: { periodEnd: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<SyncPhase>("syncing");
  const attemptsRef = useRef(0);

  const runSync = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setPhase("syncing");

      const response = await fetch("/api/billing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => null);

      if (signal?.cancelled) {
        return;
      }

      if (!response?.ok) {
        setPhase("failed");
        return;
      }

      const body = (await response.json().catch(() => null)) as SyncResponseBody | null;
      if (signal?.cancelled) {
        return;
      }

      const stillStale =
        !body?.synced ||
        isStaleBillingPeriod({ status: body.status, currentPeriodEnd: body.currentPeriodEnd });

      if (body?.synced) {
        router.refresh();
      }

      if (stillStale) {
        setPhase("unresolved");
      }
    },
    [router],
  );

  useEffect(() => {
    if (attemptsRef.current >= MAX_AUTOMATIC_ATTEMPTS) {
      setPhase("unresolved");
      return;
    }

    attemptsRef.current += 1;
    const signal = { cancelled: false };
    void runSync(signal);

    return () => {
      signal.cancelled = true;
    };
  }, [periodEnd, runSync]);

  return (
    <div aria-live="polite">
      {phase === "syncing" ? (
        <Alert tone="info" heading="Confirming your renewal date">
          Your plan is unchanged while we check the latest billing details with Stripe.
        </Alert>
      ) : phase === "failed" ? (
        <Alert tone="danger" heading="We couldn't reach Stripe">
          <div className="space-y-3">
            <p>Your Sevri Pro access is unchanged. The renewal date will appear once billing details load.</p>
            <Button type="button" variant="outline" onClick={() => void runSync()}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : (
        <Alert tone="warning" heading="Your renewal date needs a look">
          <div className="space-y-3">
            <p>
              Sevri Pro is still active on your account, but Stripe has not reported a current renewal date. Open the
              billing portal to see your latest invoice.
            </p>
            <Button type="button" variant="outline" onClick={() => void runSync()}>
              Check again
            </Button>
          </div>
        </Alert>
      )}
    </div>
  );
}
