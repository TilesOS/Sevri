import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/shared/auth-form";

export default function SignUpPage() {
  return (
    <Card className="mx-auto w-full max-w-xl space-y-6" padding="lg">
      <Badge tone="accent">Free to start</Badge>
      <div className="space-y-2">
        <h1 className="font-display text-4xl leading-none text-ink">Create your Sevri account</h1>
        <p className="text-sm leading-6 text-ink-soft">
          Start with guided onboarding and two recommendation batches while you decide which direction deserves your best work.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading sign-up form...</p>}>
        <AuthForm mode="sign-up" />
      </Suspense>
      <p className="text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-secondary-blue hover:opacity-80">
          Sign in
        </Link>
      </p>
    </Card>
  );
}

