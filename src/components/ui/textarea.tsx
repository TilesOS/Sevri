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
        "min-h-28 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted outline-none transition-colors",
        "focus:border-primary/50 focus:bg-paper focus:ring-2 focus:ring-primary/10",
        "disabled:cursor-not-allowed disabled:bg-surface/60 disabled:text-ink-muted",
        className,
      )}
      {...props}
    />
  );
});
