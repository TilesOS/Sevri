import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

interface NotFoundAction {
  href: string;
  label: string;
  variant?: "primary" | "outline";
}

interface NotFoundStateProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions: NotFoundAction[];
  children?: ReactNode;
}

/**
 * Shared branded 404. Every not-found boundary uses this so the wording, the
 * recovery links, and the opt-out from the page-enter fade stay consistent —
 * the default Next.js 404 had none of the three.
 */
export function NotFoundState({
  eyebrow = "Not found",
  title,
  description,
  actions,
  children,
}: NotFoundStateProps) {
  return (
    <Card padding="lg" className="space-y-6" data-page-enter-skip>
      <PageHeader eyebrow={eyebrow} title={title} description={description} className="border-b-0 pb-0" />

      {children}

      <div className="flex flex-wrap gap-3">
        {actions.map((action) => (
          <Button key={action.href} href={action.href} size="lg" variant={action.variant ?? "primary"}>
            {action.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
