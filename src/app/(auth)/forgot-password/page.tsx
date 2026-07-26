import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/shared/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Get a password reset link for your Sevri account.",
  robots: { index: false, follow: false },
};

/** Errors handed over by /auth/callback when a recovery link no longer works. */
const CALLBACK_ERRORS: Record<string, string> = {
  link_invalid:
    "That reset link isn't valid anymore — links expire after about an hour and can only be used once. Request a fresh one below.",
  link_missing: "That reset link was incomplete. Request a fresh one below.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolved = await searchParams;
  const initialError = resolved?.error ? CALLBACK_ERRORS[resolved.error] ?? null : null;

  return (
    <Card className="mx-auto w-full max-w-xl space-y-6 shadow-soft" padding="lg">
      <div className="space-y-2">
        <p className="font-serif text-lg italic text-coral">Password reset</p>
        <h1 className="font-display text-4xl leading-none text-ink">Let&apos;s get you back in.</h1>
        <p className="text-sm leading-6 text-ink-soft">
          Enter the email you signed up with and we&apos;ll send a link to choose a new password.
        </p>
      </div>

      <ForgotPasswordForm initialError={initialError} />
    </Card>
  );
}
