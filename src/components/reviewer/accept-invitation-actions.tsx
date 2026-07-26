"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toUserFacingAuthError } from "@/lib/auth/ui-error";

interface AcceptInvitationActionsProps {
  token: string;
  reviewerEmail: string;
  isSignedIn: boolean;
  signedInEmail: string | null;
  signedInRole: "student" | "reviewer" | null;
  emailMismatch: boolean;
  projectTitle: string;
}

export function AcceptInvitationActions({
  token,
  reviewerEmail,
  isSignedIn,
  signedInEmail,
  signedInRole,
  emailMismatch,
  projectTitle,
}: AcceptInvitationActionsProps) {
  const router = useRouter();
  const [linkSent, setLinkSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSendMagicLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const redirectUrl = new URL("/auth/callback", window.location.origin);
      redirectUrl.searchParams.set("next", `/accept-invitation/${token}`);

      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: reviewerEmail,
        options: {
          emailRedirectTo: redirectUrl.toString(),
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        throw otpError;
      }

      setLinkSent(true);
    } catch (authError) {
      setError(
        toUserFacingAuthError(
          authError,
          "We couldn't send that sign-in link. Check your connection and try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignOut() {
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw signOutError;
      }
      router.refresh();
    } catch (authError) {
      setError(
        toUserFacingAuthError(
          authError,
          "We couldn't sign you out. Check your connection and try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAccept() {
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Unable to accept invitation.");
        return;
      }

      const body = (await res.json()) as { project_id: string };
      router.push(`/reviewer/project/${body.project_id}`);
      router.refresh();
    } catch {
      setError("Unable to accept invitation.");
    } finally {
      setIsLoading(false);
    }
  }

  if (!isSignedIn) {
    if (linkSent) {
      return (
        <Alert tone="success" heading="Check your email">
          We sent a sign-in link to <strong>{reviewerEmail}</strong>. Click it to finish setting up your reviewer
          account and come back here to accept.
        </Alert>
      );
    }

    return (
      <form onSubmit={handleSendMagicLink} className="space-y-4">
        <FormField label="Reviewer email" htmlFor="reviewer-email">
          <Input id="reviewer-email" type="email" value={reviewerEmail} readOnly />
        </FormField>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Button type="submit" size="lg" disabled={isLoading} fullWidth>
          {isLoading ? "Sending link..." : "Email me a sign-in link"}
        </Button>
        <p className="text-xs leading-5 text-ink-soft">
          We&rsquo;ll email you a one-time link. Clicking it signs you in and brings you back here to accept.
        </p>
      </form>
    );
  }

  if (emailMismatch) {
    return (
      <div className="space-y-4">
        <Alert tone="danger" heading="Signed in with a different email">
          You&rsquo;re signed in as <strong>{signedInEmail}</strong>. This invitation was sent to{" "}
          <strong>{reviewerEmail}</strong>. Sign out and use the invited address.
        </Alert>
        <Button variant="outline" onClick={handleSignOut} disabled={isLoading}>
          {isLoading ? "Signing out..." : "Sign out"}
        </Button>
      </div>
    );
  }

  if (signedInRole === "student") {
    return (
      <div className="space-y-4">
        <Alert tone="warning" heading="This invitation is for a reviewer account">
          You&rsquo;re signed in as a student. Reviewers use a separate account &mdash; sign out and create a
          reviewer account with the invited email, or ask the student to use a different address.
        </Alert>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={handleSignOut} disabled={isLoading}>
            {isLoading ? "Signing out..." : "Sign out"}
          </Button>
          <Button variant="ghost" href="/">
            Go to Sevri
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button size="lg" onClick={handleAccept} disabled={isLoading}>
        {isLoading ? "Accepting..." : `Accept invitation to review ${projectTitle}`}
      </Button>
    </div>
  );
}
