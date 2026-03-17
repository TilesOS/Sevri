"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
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
      <div aria-live="polite" className="sr-only">
        {info ?? error ?? (loading ? "Updating billing state." : "")}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={hasSubscription ? openPortal : startCheckout} disabled={loading !== null} className="rounded-full px-6">
          {hasSubscription
            ? loading === "portal"
              ? "Opening portal..."
              : "Manage subscription"
            : loading === "checkout"
              ? "Opening checkout..."
              : "Upgrade to Pro"}
        </Button>

        <Button variant="outline" onClick={syncBilling} disabled={loading !== null} className="rounded-full">
          {loading === "sync" ? "Syncing..." : "Sync billing now"}
        </Button>
      </div>

      {info ? <Alert tone="success">{info}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}
