"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ReviewerInviteModalProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

const MAX_NOTE = 500;

export function ReviewerInviteModal({ projectId, open, onClose }: ReviewerInviteModalProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail("");
    setNote("");
    setError(null);
    setIsSubmitting(false);
    setSuccess(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer_email: email.trim(),
          personal_note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to send invitation.");
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      setIsSubmitting(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-paper p-6 shadow-lifted">
        <div className="space-y-2">
          <h2 className="font-display text-2xl text-ink">Invite a reviewer</h2>
          <p className="text-sm leading-6 text-ink-soft">
            Reviewers see a read-only view of this project and can leave structured feedback per milestone. They
            won&rsquo;t be billed. Invitations expire after 14 days.
          </p>
        </div>

        {success ? (
          <div className="mt-5 space-y-4">
            <Alert tone="success" heading="Invitation sent">
              We emailed the invite. Once the reviewer accepts, they&rsquo;ll appear in your reviewers list.
            </Alert>
            <div className="flex justify-end">
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <FormField label="Reviewer email" htmlFor="reviewer-email" required>
              <Input
                id="reviewer-email"
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teacher@school.edu"
              />
            </FormField>

            <FormField
              label="Personal note (optional)"
              htmlFor="personal-note"
              hint={`${note.length} / ${MAX_NOTE} characters`}
            >
              <Textarea
                id="personal-note"
                maxLength={MAX_NOTE}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="A short note so they know why you&rsquo;re asking."
              />
            </FormField>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || email.trim().length === 0}>
                {isSubmitting ? "Sending..." : "Send invitation"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
