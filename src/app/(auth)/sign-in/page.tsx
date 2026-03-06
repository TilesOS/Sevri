import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/shared/auth-form";

export default function SignInPage() {
  return (
    <Card className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-ink-900">Welcome back</h1>
        <p className="text-sm text-ink-600">Sign in to continue your project journey.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-600">Loading sign-in form...</p>}>
        <AuthForm mode="sign-in" />
      </Suspense>
      <p className="text-sm text-ink-600">
        No account yet? <Link href="/sign-up">Create one</Link>
      </p>
    </Card>
  );
}