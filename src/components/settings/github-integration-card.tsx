"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { UserIntegrationPublicRow } from "@/lib/db/queries/github";

interface GithubIntegrationCardProps {
  integration: UserIntegrationPublicRow | null;
  connectedFlag: boolean;
  errorFlag: string | null;
}

const ERROR_COPY: Record<string, string> = {
  state_mismatch: "GitHub sign-in expired or was tampered with. Try connecting again.",
  code_exchange_failed: "GitHub did not accept the sign-in code. Try connecting again.",
  user_fetch_failed: "Connected, but we couldn't read your GitHub profile. Try reconnecting.",
  persist_failed: "Connected, but we couldn't save the connection. Try again.",
  missing_scopes: "Sevri needs the public_repo and read:user scopes. Reconnect and grant both.",
  authorize_failed: "Could not start the GitHub sign-in. Try again.",
};

export function GithubIntegrationCard({
  integration,
  connectedFlag,
  errorFlag,
}: GithubIntegrationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const connected = integration !== null;

  async function disconnect() {
    setError(null);
    const res = await fetch("/api/integrations/github", { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to disconnect GitHub. Try again.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {connectedFlag ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          GitHub connected.
        </div>
      ) : null}
      {errorFlag && ERROR_COPY[errorFlag] ? (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {ERROR_COPY[errorFlag]}
        </div>
      ) : null}

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">GitHub</p>
            <p className="mt-2 text-sm leading-6 text-ink-soft">
              {connected
                ? `Connected as @${integration.provider_username}.`
                : "Link public repositories whenever they help document a project."}
            </p>
          </div>
          {connected ? (
            <Button
              type="button"
              variant="outline"
              onClick={disconnect}
              disabled={isPending}
            >
              {isPending ? "Disconnecting..." : "Disconnect"}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                window.location.href = "/api/integrations/github/authorize";
              }}
            >
              Connect GitHub
            </Button>
          )}
        </div>
        {integration?.status === "invalid" ? (
          <p className="text-sm text-red-600">
            Your GitHub connection was revoked or is missing scopes. Reconnect to resume syncing.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </Card>
    </div>
  );
}
