"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface BillingActionsProps {
  hasSubscription: boolean;
}

export function BillingActions({ hasSubscription }: BillingActionsProps) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setLoading("checkout");
    setError(null);

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

    const response = await fetch("/api/billing/portal", { method: "POST" });
    const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

    if (!response.ok || !body?.url) {
      setError(body?.error ?? "Failed to open billing portal");
      setLoading(null);
      return;
    }

    window.location.href = body.url;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={startCheckout} disabled={loading !== null}>
          {loading === "checkout" ? "Opening checkout..." : "Upgrade to Pro"}
        </Button>

        {hasSubscription ? (
          <Button variant="secondary" onClick={openPortal} disabled={loading !== null}>
            {loading === "portal" ? "Opening portal..." : "Manage subscription"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}