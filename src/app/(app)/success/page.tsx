import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SuccessPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Upgrade complete</h1>
        <p className="text-sm text-ink-700">Your ProjectForge Pro access will sync within a few seconds.</p>
        <div className="flex justify-center gap-3">
          <Link href="/billing">
            <Button variant="secondary">Back to billing</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}