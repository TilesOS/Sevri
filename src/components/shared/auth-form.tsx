"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { toUserFacingAuthError } from "@/lib/auth/ui-error";
import { createClient } from "@/lib/supabase/client";
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
  const [signUpComplete, setSignUpComplete] = useState(false);

  async function handleOAuthSignIn(provider: OAuthProvider) {
    setError(null);

    if (mode === "sign-up" && !ageConsent) {
      setError("Please confirm you are at least 13 years old. If you are under 13, a parent or guardian must contact support@sevri.co before an account can be created.");
      return;
    }

    setIsLoading(true);
    setOauthProvider(provider);

    try {
      const next = getSafeRedirectPath(searchParams.get("next"));
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", next);
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (oauthError) {
      setError(
        toUserFacingAuthError(
          oauthError,
          "We couldn't start that sign-in. Check your connection and try again.",
        ),
      );
    } finally {
      setIsLoading(false);
      setOauthProvider(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOauthProvider(null);

    if (mode === "sign-up" && !fullName.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (mode === "sign-up" && !ageConsent) {
      setError("Please confirm you are at least 13 years old. If you are under 13, a parent or guardian must contact support@sevri.co before an account can be created.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();

      if (mode === "sign-in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          throw signInError;
        }

        router.replace(getSafeRedirectPath(searchParams.get("next")));
        router.refresh();
        return;
      }

      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/dashboard");
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: callbackUrl.toString(),
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setSignUpComplete(true);
    } catch (authError) {
      setError(
        toUserFacingAuthError(
          authError,
          mode === "sign-in"
            ? "We couldn't sign you in. Check your connection and try again."
            : "We couldn't create your account. Check your connection and try again.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }

  if (signUpComplete) {
    return (
      <div className="space-y-5">
        <Alert tone="success" heading="Check your email">
          We sent a confirmation link to <strong>{email}</strong>. Open it to finish creating your account
          and sign in to Sevri.
        </Alert>
        <p className="text-sm text-ink-soft">
          Already confirmed?{" "}
          <Link href="/sign-in" className="font-semibold text-coral hover:opacity-80">
            Sign in
          </Link>
        </p>
      </div>
    );
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
