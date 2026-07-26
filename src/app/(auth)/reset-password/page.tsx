import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth/guard";
import { ResetPasswordForm } from "@/components/shared/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Finish resetting the password on your Sevri account.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage() {
  // The recovery link exchanges its code in /auth/callback, which leaves a
  // session behind. No session here means the link expired, was already used,
  // or someone opened this page directly — all recoverable by requesting a new
  // one, so say that instead of redirecting to a form with no explanation.
  const user = await getAuthenticatedUser();

  if (!user) {
    return (
      <Card className="mx-auto w-full max-w-xl space-y-6 shadow-soft" padding="lg">
        <div className="space-y-2">
          <p className="font-serif text-lg italic text-coral">Password reset</p>
          <h1 className="font-display text-4xl leading-none text-ink">That link has expired.</h1>
        </div>

        <Alert tone="warning" heading="Reset links last about an hour">
          They also stop working once they&apos;ve been used. Request a new one and it will arrive in a moment.
        </Alert>

        <div className="flex flex-wrap gap-3">
          <Button href="/forgot-password" size="lg">
            Send a new link
          </Button>
          <Button href="/sign-in" size="lg" variant="outline">
            Back to sign in
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-xl space-y-6 shadow-soft" padding="lg">
      <div className="space-y-2">
        <p className="font-serif text-lg italic text-coral">Password reset</p>
        <h1 className="font-display text-4xl leading-none text-ink">Choose a new password.</h1>
        <p className="text-sm leading-6 text-ink-soft">
          You&apos;re resetting the password for <span className="font-semibold text-ink">{user.email}</span>.
        </p>
      </div>

      <ResetPasswordForm />

      <p className="text-sm text-ink-soft">
        Wrong account?{" "}
        <Link href="/forgot-password" className="font-semibold text-coral hover:opacity-80">
          Start over
        </Link>
      </p>
    </Card>
  );
}
