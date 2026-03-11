"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface BillingActionsProps {
  hasSubscription: boolean;
}

export function BillingActions({ hasSubscription }: BillingActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"checkout" | "portal" | "sync" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function startCheckout() {
    setLoading("checkout");
    setError(null);
    setInfo(null);

    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

    if (!response.ok || !body?.url) {
      setError(body?.error ?? "Failed to start checkout");
      setLoading(null);
      return;
    }

    window.location.href = body.url;
  }

  async function openPortal() {
    setLoading("portal");
    setError(null);
    setInfo(null);

    const response = await fetch("/api/billing/portal", { method: "POST" });
    const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

    if (!response.ok || !body?.url) {
      setError(body?.error ?? "Failed to open billing portal");
      setLoading(null);
      return;
    }

    window.location.href = body.url;
  }

  async function syncBilling() {
    setLoading("sync");
    setError(null);
    setInfo(null);

    const response = await fetch("/api/billing/sync", { method: "POST" });
    const body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;

    if (!response.ok) {
      setError(body?.error ?? "Failed to sync billing status");
      setLoading(null);
      return;
    }

    setInfo(body?.message ?? "Billing sync completed.");
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={startCheckout} disabled={loading !== null}>
          {loading === "checkout" ? "Opening checkout..." : "Upgrade to Pro"}
        </Button>

        {hasSubscription ? (
          <Button variant="secondary" onClick={openPortal} disabled={loading !== null}>
            {loading === "portal" ? "Opening portal..." : "Manage subscription"}
          </Button>
        ) : null}

        <Button variant="secondary" onClick={syncBilling} disabled={loading !== null}>
          {loading === "sync" ? "Syncing..." : "Sync billing now"}
        </Button>
      </div>

      {info ? <p className="text-sm text-mint-700">{info}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
