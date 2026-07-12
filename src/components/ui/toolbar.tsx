import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="toolbar"
      className={cn("flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-line py-2", className)}
      {...props}
    />
  );
}
