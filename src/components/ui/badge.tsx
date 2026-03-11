import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-medium text-ink-800",
        className,
      )}
      {...props}
    />
  );
}
