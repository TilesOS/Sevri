import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/shared/auth-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Sevri workspace.",
};

export default function SignInPage() {
  return (
    <Card className="mx-auto w-full max-w-xl space-y-6 shadow-soft" padding="lg">
      <div className="space-y-2">
        <p className="font-serif text-lg italic text-coral">Welcome back</p>
        <h1 className="font-display text-4xl leading-none text-ink">Pick up where you left off.</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading sign-in form...</p>}>
        <AuthForm mode="sign-in" />
      </Suspense>
      <p className="text-sm text-ink-soft">
        No account yet?{" "}
        <Link href="/sign-up" className="font-semibold text-coral hover:opacity-80">
          Create one
        </Link>
      </p>
    </Card>
  );
}
