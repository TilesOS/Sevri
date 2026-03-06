import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CancelPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-ink-900">Checkout canceled</h1>
        <p className="text-sm text-ink-700">No changes were made. You can continue with the free tier anytime.</p>
        <div className="flex justify-center gap-3">
          <Link href="/pricing">
            <Button variant="secondary">View pricing</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Back to dashboard</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}