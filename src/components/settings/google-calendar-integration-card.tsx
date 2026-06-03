"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { GoogleCalendarSyncSettingsRow } from "@/lib/db/queries/google-calendar";
import type { UserIntegrationPublicRow } from "@/lib/db/queries/github";

interface GoogleCalendarIntegrationCardProps {
  integration: UserIntegrationPublicRow | null;
  settings: GoogleCalendarSyncSettingsRow | null;
  connectedFlag: boolean;
  errorFlag: string | null;
}

const ERROR_COPY: Record<string, string> = {
  google_calendar_authorize_failed: "Could not start Google Calendar authorization. Check the Calendar OAuth env vars.",
  google_calendar_state_mismatch: "Google Calendar authorization expired or was tampered with. Try connecting again.",
  google_calendar_code_exchange_failed: "Google did not accept the authorization code. Try connecting again.",
  google_calendar_identity_failed: "Connected, but we could not read the Google account identity. Try reconnecting.",
  google_calendar_persist_failed: "Connected, but Sevri could not save the Calendar connection. Try again.",
  google_calendar_missing_scopes: "Sevri needs permission to create and manage its own Google Calendar.",
  google_calendar_missing_refresh_token: "Google did not provide offline access. Reconnect and approve access again.",
  google_calendar_initial_sync_failed: "Google Calendar connected, but the first sync failed. Use Resync below.",
};

function formatSyncTime(value: string | null | undefined) {
  if (!value) {
    return "Not synced yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function GoogleCalendarIntegrationCard({
  integration,
  settings,
  connectedFlag,
  errorFlag,
}: GoogleCalendarIntegrationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [action, setAction] = useState<"disconnect" | "resync" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const connected = integration !== null;

  async function disconnect() {
    setError(null);
    setAction("disconnect");
    const res = await fetch("/api/integrations/google-calendar", { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to disconnect Google Calendar. Try again.");
      setAction(null);
      return;
    }
    startTransition(() => router.refresh());
  }

  async function resync() {
    setError(null);
    setAction("resync");
    const res = await fetch("/api/integrations/google-calendar", { method: "POST" });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(body?.error ?? "Failed to sync Google Calendar. Try again.");
      setAction(null);
      return;
    }
    startTransition(() => router.refresh());
    setAction(null);
  }

  return (
    <div className="space-y-4">
      {connectedFlag ? (
        <div
          role="status"
          className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          Google Calendar connected.
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

      <Card tone="primary" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="editorial-kicker">Google Calendar</p>
            <p className="text-sm leading-6 text-ink-soft">
              {connected
                ? `Connected as ${integration.provider_username}. Sevri syncs to a dedicated Google calendar.`
                : "Create a dedicated Google calendar for Sevri due dates and planned work blocks."}
            </p>
            {connected ? (
              <div className="space-y-1 text-xs text-ink-muted">
                <p>Status: {settings?.status ?? integration.status}</p>
                <p>Last sync: {formatSyncTime(settings?.last_synced_at)}</p>
                {settings?.last_error ? <p className="text-red-600">{settings.last_error}</p> : null}
              </div>
            ) : null}
          </div>

          {connected ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void resync()}
                disabled={isPending || action !== null}
              >
                {action === "resync" ? "Syncing..." : "Resync"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => void disconnect()}
                disabled={isPending || action !== null}
              >
                {action === "disconnect" ? "Disconnecting..." : "Disconnect"}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={() => {
                window.location.href = "/api/integrations/google-calendar/authorize";
              }}
            >
              Connect Calendar
            </Button>
          )}
        </div>

        {integration?.status === "invalid" || settings?.status === "invalid" ? (
          <p className="text-sm text-red-600">
            Google Calendar access needs to be reconnected before sync can resume.
          </p>
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </Card>
    </div>
  );
}

