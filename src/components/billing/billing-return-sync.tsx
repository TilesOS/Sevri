"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";

const RETRY_DELAYS_MS = [0, 2000, 4000, 8000, 12000] as const;

type CheckoutState = "success" | "cancel" | null;
type SyncPhase = "idle" | "syncing" | "timed_out";

interface BillingReturnSyncProps {
  checkoutState: CheckoutState;
  sessionId: string | null;
  isEntitled: boolean;
}

export function BillingReturnSync({ checkoutState, sessionId, isEntitled }: BillingReturnSyncProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (checkoutState !== "success" || isEntitled) {
      setPhase("idle");
      setAttempt(0);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Billing used to require a manual sync because the Checkout return page
    // never performed a server-verified reconciliation while the webhook was
    // still in flight, leaving users stuck on the stale checkout_pending row.
    const runAttempt = async (index: number) => {
      setPhase("syncing");
      setAttempt(index + 1);

      const response = await fetch("/api/billing/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
      }).catch(() => null);

      if (cancelled) {
        return;
      }

      if (response?.ok) {
        router.refresh();

        const body = (await response.json().catch(() => null)) as { entitled?: boolean } | null;
        if (body?.entitled) {
          return;
        }
      }

      if (index >= RETRY_DELAYS_MS.length - 1) {
        setPhase("timed_out");
        return;
      }

      const nextDelay = RETRY_DELAYS_MS[index + 1] - RETRY_DELAYS_MS[index];
      timeoutId = setTimeout(() => {
        void runAttempt(index + 1);
      }, nextDelay);
    };

    void runAttempt(0);

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [checkoutState, isEntitled, router, sessionId]);

  if (checkoutState === "cancel") {
    return (
      <Alert tone="info" heading="Checkout canceled">
        No billing change was applied. You can upgrade again whenever you are ready.
      </Alert>
    );
  }

  if (checkoutState !== "success") {
    return null;
  }

  if (isEntitled) {
    return (
      <Alert tone="success" heading="Upgrade confirmed">
        Your billing changes are confirmed and Sevri Pro is active.
      </Alert>
    );
  }

  if (phase === "timed_out") {
    return (
      <Alert tone="warning" heading="Still confirming your upgrade">
        Stripe is taking a little longer than usual to finish the billing sync. We will keep checking when you refresh, and
        you can use the Sync billing now button below if you want to prompt another check immediately.
      </Alert>
    );
  }

  return (
    <Alert tone="info" heading="Finishing your upgrade...">
      We are confirming your subscription with Stripe and refreshing this page automatically. This usually takes a few
      seconds.
      {attempt > 0 ? ` Attempt ${attempt} of ${RETRY_DELAYS_MS.length}.` : ""}
    </Alert>
  );
}
