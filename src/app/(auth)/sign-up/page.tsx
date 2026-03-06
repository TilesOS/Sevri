import { Suspense } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/shared/auth-form";

export default function SignUpPage() {
  return (
    <Card className="mx-auto w-full max-w-md space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-ink-900">Create your ProjectForge account</h1>
        <p className="text-sm text-ink-600">Start with free onboarding and your first recommendation batch.</p>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-600">Loading sign-up form...</p>}>
        <AuthForm mode="sign-up" />
      </Suspense>
      <p className="text-sm text-ink-600">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </Card>
  );
}