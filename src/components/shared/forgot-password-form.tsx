"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { toUserFacingError } from "@/lib/errors/user-messages";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "sent"; message: string }
  | { status: "error"; message: string };

export function ForgotPasswordForm({ initialError }: { initialError?: string | null }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<FormState>(() =>
    initialError ? { status: "error", message: initialError } : { status: "idle" },
  );

  const isSubmitting = state.status === "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting" });

    let response: Response;
    let body: { message?: string; error?: string } | null = null;

    try {
      response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      body = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    } catch {
      setState({
        status: "error",
        message: "We couldn't reach Sevri. Check your connection and try again.",
      });
      return;
    }

    if (!response.ok) {
      setState({
        status: "error",
        message: toUserFacingError(body?.error, "We couldn't start a password reset. Try again in a moment."),
      });
      return;
    }

    setState({
      status: "sent",
      message:
        body?.message ??
        "If that email has a Sevri account, a reset link is on its way. It expires in about an hour.",
    });
  }

  if (state.status === "sent") {
    return (
      <div className="space-y-5">
        <Alert tone="success" heading="Check your email">
          {state.message}
        </Alert>
        <p className="text-sm leading-6 text-ink-soft">
          Nothing in your inbox after a few minutes? Look in spam, then{" "}
          <button
            type="button"
            className="font-semibold text-coral underline hover:opacity-80"
            onClick={() => setState({ status: "idle" })}
          >
            try a different address
          </button>
          .
        </p>
        <p className="text-sm text-ink-soft">
          <Link href="/sign-in" className="font-semibold text-coral hover:opacity-80">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div aria-live="polite" className="sr-only">
        {state.status === "error" ? state.message : isSubmitting ? "Sending reset link." : ""}
      </div>

      <FormField label="Email" htmlFor="recovery-email" required>
        <Input
          id="recovery-email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@student.edu"
          autoComplete="email"
          autoFocus
          required
        />
      </FormField>

      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}

      <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>

      <p className="text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/sign-in" className="font-semibold text-coral hover:opacity-80">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
