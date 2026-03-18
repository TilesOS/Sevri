import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AuthForm } from "@/components/shared/auth-form";

export default function SignInPage() {
  return (
    <Card className="mx-auto w-full max-w-xl space-y-6" padding="lg">
      <Badge tone="neutral">Welcome back</Badge>
      <div className="space-y-2">
        <h1 className="font-display text-4xl leading-none text-ink">Pick up where you left off.</h1>
        <p className="text-sm leading-6 text-ink-soft">
          Your roadmap, saved projects, and recommendation boards are waiting inside your workspace.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-ink-soft">Loading sign-in form...</p>}>
        <AuthForm mode="sign-in" />
      </Suspense>
      <p className="text-sm text-ink-soft">
        No account yet?{" "}
        <Link href="/sign-up" className="font-semibold text-secondary-blue hover:opacity-80">
          Create one
        </Link>
      </p>
    </Card>
  );
}
