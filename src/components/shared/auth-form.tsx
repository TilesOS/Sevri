"use client";

import { type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

type AuthMode = "sign-in" | "sign-up";
type OAuthProvider = "google" | "github";

interface AuthFormProps {
  mode: AuthMode;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<OAuthProvider | null>(null);

  async function handleOAuthSignIn(provider: OAuthProvider) {
    setError(null);
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
      setError(oauthError.message);
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
        setError(signInError.message);
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
      setError(signUpError.message);
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

      <div className="space-y-4">
        <div className="mx-auto w-full max-w-md space-y-4">
          {mode === "sign-in" ? (
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
          ) : null}
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
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@student.edu"
          required
        />
      </FormField>

      <FormField label="Password" htmlFor="password" required>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          minLength={8}
          required
        />
      </FormField>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {mode === "sign-up" ? (
        <p className="text-sm leading-6 text-ink-soft">
          After you create your account, check your email for a confirmation link to finish setup.
        </p>
      ) : null}

      <Button type="submit" size="lg" fullWidth disabled={isLoading} className="mt-1">
        {isLoading ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}
