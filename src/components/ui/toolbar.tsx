import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="toolbar"
      className={cn("flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-2 py-1.5 shadow-[0_1px_2px_rgba(32,32,29,0.03)]", className)}
      {...props}
    />
  );
}
