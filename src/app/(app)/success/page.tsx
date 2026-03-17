import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SuccessPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="space-y-5 text-center">
        <p className="editorial-kicker">Billing update</p>
        <h1 className="font-display text-4xl leading-none text-ink">Upgrade complete</h1>
        <p className="text-sm leading-6 text-ink-soft">Your Sevri Pro access will sync within a few seconds.</p>
        <div className="flex justify-center gap-3">
          <Button href="/billing" variant="outline" className="rounded-full">
            Back to billing
          </Button>
          <Button href="/dashboard" className="rounded-full">
            Go to dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
