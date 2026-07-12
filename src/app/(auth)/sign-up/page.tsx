import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/shared/auth-form";

export default function SignUpPage() {
  return (
    <Card className="mx-auto w-full max-w-xl space-y-6 shadow-soft" padding="lg">
      <div className="space-y-2">
        <p className="font-serif text-lg italic text-teal-deep">Free to start</p>
        <h1 className="font-display text-4xl leading-none text-ink">Create your Sevri account.</h1>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading sign-up form...</p>}>
        <AuthForm mode="sign-up" />
      </Suspense>
      <p className="text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-semibold text-navy transition-colors hover:text-teal-deep">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
