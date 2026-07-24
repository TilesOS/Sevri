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
    <Card className={cn("space-y-2", className)} tone="default" padding="md" elevation="soft">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <p className="text-2xl font-semibold leading-none tracking-tight text-ink">{value}</p>
      {detail ? <p className="text-sm leading-6 text-ink-soft">{detail}</p> : null}
    </Card>
  );
}
