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
        "min-h-28 w-full rounded-xl border border-line/80 bg-paper px-4 py-3 text-sm text-ink shadow-[0_1px_0_rgba(11,21,38,0.02)] placeholder:text-ink-muted outline-none transition",
        "focus:border-primary/50 focus:bg-paper focus:ring-4 focus:ring-primary/10",
        "disabled:cursor-not-allowed disabled:bg-surface/60 disabled:text-ink-muted",
        className,
      )}
      {...props}
    />
  );
});
