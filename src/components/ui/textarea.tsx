import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-sm text-ink-900 placeholder:text-ink-600 outline-none transition focus:border-mint-500 focus:ring-2 focus:ring-mint-500/25",
        className,
      )}
      {...props}
    />
  );
});
