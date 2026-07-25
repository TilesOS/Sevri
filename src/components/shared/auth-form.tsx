"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toUserFacingError } from "@/lib/errors/user-messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

type AuthMode = "sign-in" | "sign-up";
type OAuthProvider = "google" | "github";

interface AuthFormProps {
  mode: AuthMode;
}

/** Reasons /auth/callback can bounce someone here, in copy they can act on. */
const CALLBACK_ERRORS: Record<string, string> = {
  link_invalid: "That link isn't valid anymore. Sign in below, or request a new password reset link.",
  link_missing: "That link was incomplete. Sign in below, or request a new password reset link.",
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackError = CALLBACK_ERRORS[searchParams.get("error") ?? ""] ?? null;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ageConsent, setAgeConsent] = useState(false);
  const [error, setError] = useState<string | null>(callbackError);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<OAuthProvider | null>(null);

  async function handleOAuthSignIn(provider: OAuthProvider) {
    setError(null);

    if (mode === "sign-up" && !ageConsent) {
      setError("Please confirm you are at least 13 years old. If you are under 13, a parent or guardian must contact support@sevri.co before an account can be created.");
      return;
    }

    setIsLoading(true);
    setOauthProvider(provider);

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (oauthError) {
      setError(toUserFacingError(oauthError.message, "We couldn't start that sign-in. Try again."));
      setIsLoading(false);
      setOauthProvider(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    setOauthProvider(null);

    const supabase = createClient();

    if (mode === "sign-in") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(toUserFacingError(signInError.message, "We couldn't sign you in. Try again."));
        setIsLoading(false);
        return;
      }

      const next = searchParams.get("next") ?? "/dashboard";
      router.push(next);
      router.refresh();
      return;
    }

    if (!fullName.trim()) {
      setError("Please enter your name.");
      setIsLoading(false);
      return;
    }

    if (!ageConsent) {
      setError("Please confirm you are at least 13 years old. If you are under 13, a parent or guardian must contact support@sevri.co before an account can be created.");
      setIsLoading(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (signUpError) {
      setError(toUserFacingError(signUpError.message, "We couldn't create your account. Try again."));
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div aria-live="polite" className="sr-only">
        {error ?? (isLoading ? "Submitting form." : "")}
      </div>

      {mode === "sign-up" ? (
        <label className="flex items-start gap-3 text-sm leading-6 text-ink-soft">
          <input
            type="checkbox"
            name="age_consent"
            checked={ageConsent}
            onChange={(event) => setAgeConsent(event.target.checked)}
            disabled={isLoading}
            className="mt-1"
            required
          />
          <span>
            I confirm that I am at least 13 years old. I agree to the{" "}
            <Link href="/terms" className="font-semibold text-ink underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-ink underline">
              Privacy Policy
            </Link>
            . If you are under 13, a parent or guardian must{" "}
            <a className="font-semibold text-ink underline" href="mailto:support@sevri.co">
              contact us
            </a>{" "}
            before an account can be created.
          </span>
        </label>
      ) : null}

      <div className="space-y-4">
        <div className="mx-auto w-full max-w-md space-y-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            fullWidth
            disabled={isLoading}
            onClick={() => handleOAuthSignIn("google")}
          >
            {oauthProvider === "google" ? "Redirecting..." : "Continue with Google"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            fullWidth
            disabled={isLoading}
            onClick={() => handleOAuthSignIn("github")}
          >
            {oauthProvider === "github" ? "Redirecting..." : "Continue with GitHub"}
          </Button>
          <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-ink-soft/80">
            <span className="h-px flex-1 bg-line" />
            <span>Or continue with email</span>
            <span className="h-px flex-1 bg-line" />
          </div>
        </div>
      </div>

      {mode === "sign-up" ? (
        <FormField label="Name" htmlFor="full_name" required>
          <Input
            id="full_name"
            name="full_name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Alex Johnson"
            autoComplete="name"
            required
          />
        </FormField>
      ) : null}

      <FormField label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@student.edu"
          autoComplete="email"
          required
        />
      </FormField>

      <FormField label="Password" htmlFor="password" required>
        <PasswordInput
          id="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
      </FormField>

      {mode === "sign-in" ? (
        <p className="-mt-2 text-sm">
          <Link href="/forgot-password" className="font-semibold text-coral hover:opacity-80">
            Forgot your password?
          </Link>
        </p>
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {mode === "sign-up" ? (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-ink-soft">
            After you create your account, check your email for a confirmation link to finish setup.
          </p>
        </div>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={isLoading} className="mt-1">
        {isLoading ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
