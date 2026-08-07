"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function EmailPreferencesCard({
  initialEnabled,
  suppressed,
}: {
  initialEnabled: boolean;
  suppressed: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saved, setSaved] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  async function save() {
    setIsSaving(true);
    setMessage(null);
    const response = await fetch("/api/settings/email-preferences", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lifecycle_enabled: enabled }),
    });
    const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
    setIsSaving(false);
    if (!response.ok) {
      setMessage({ tone: "danger", text: body?.error ?? "We couldn't save that preference." });
      return;
    }
    setSaved(enabled);
    setMessage({ tone: "success", text: body?.message ?? "Email preferences saved." });
  }

  return (
    <Card className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-ink">Project coaching emails</h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Receive a short onboarding sequence and a coach check-in when a project has no recorded progress for 7–14 days.
        </p>
      </div>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface/50 p-4 text-sm leading-6 text-ink-soft">
        <input
          type="checkbox"
          checked={enabled}
          disabled={suppressed || isSaving}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-1 h-4 w-4 rounded border-line-strong accent-primary"
        />
        <span>
          <strong className="block text-ink">Activation and coach reminders</strong>
          Progress includes completed steps, checklist updates, work submissions, focus blocks, finished work sessions, and commits from a connected GitHub repository.
        </span>
      </label>
      {suppressed ? (
        <Alert tone="danger">Delivery is paused for this address. Contact support@sevri.co to restore it.</Alert>
      ) : null}
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      <Button type="button" onClick={save} disabled={isSaving || enabled === saved || suppressed}>
        {isSaving ? "Saving..." : "Save email preference"}
      </Button>
    </Card>
  );
}
