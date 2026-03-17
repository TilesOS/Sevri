import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, detail, className }: StatCardProps) {
  return (
    <Card className={cn("space-y-3", className)} tone="default" padding="md" elevation="soft">
      <p className="editorial-kicker">{label}</p>
      <p className="text-4xl font-semibold leading-none text-ink">{value}</p>
      {detail ? <p className="text-sm leading-6 text-ink-soft">{detail}</p> : null}
    </Card>
  );
}
