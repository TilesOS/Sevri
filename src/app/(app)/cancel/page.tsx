import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CancelPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="space-y-5 text-center">
        <p className="editorial-kicker">Billing update</p>
        <h1 className="font-display text-4xl leading-none text-ink">Checkout canceled</h1>
        <p className="text-sm leading-6 text-ink-soft">No changes were made. You can continue with the free tier anytime.</p>
        <div className="flex justify-center gap-3">
          <Button href="/pricing" variant="outline" className="rounded-full">
            View pricing
          </Button>
          <Button href="/dashboard" className="rounded-full">
            Back to dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
