"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/ui/password-input";
import { toUserFacingAuthError } from "@/lib/auth/ui-error";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

type FormState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < MIN_PASSWORD_LENGTH) {
      setState({
        status: "error",
        message: `Choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
      return;
    }

    if (password !== confirmation) {
      setState({ status: "error", message: "Those two passwords don't match. Retype them and try again." });
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setState({ status: "saved" });
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setState({
        status: "error",
        message: toUserFacingAuthError(
          error,
          "We couldn't save that password. Check your connection and try again.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (state.status === "saved") {
    return (
      <Alert tone="success" heading="Password updated">
        You&apos;re signed in — taking you to your dashboard.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div aria-live="polite" className="sr-only">
        {state.status === "error" ? state.message : isSubmitting ? "Saving your new password." : ""}
      </div>

      <FormField label="New password" htmlFor="new-password" required>
        <PasswordInput
          id="new-password"
          name="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          autoFocus
          required
        />
      </FormField>

      <FormField label="Confirm new password" htmlFor="confirm-password" required>
        <PasswordInput
          id="confirm-password"
          name="confirm-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder="Type it once more"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </FormField>

      {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}

      <Button type="submit" size="lg" fullWidth disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save new password"}
      </Button>
    </form>
  );
}
