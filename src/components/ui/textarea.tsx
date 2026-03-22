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
        "min-h-28 w-full rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-muted outline-none transition",
        "focus:border-secondary-amber focus:bg-paper",
        "disabled:cursor-not-allowed disabled:bg-surface/60 disabled:text-ink-muted",
        className,
      )}
      {...props}
    />
  );
});
