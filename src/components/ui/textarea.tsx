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
        "min-h-28 w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm text-ink shadow-[inset_0_1px_0_rgba(32,32,29,0.015)] placeholder:text-ink-muted outline-none transition-[background-color,border-color,box-shadow]",
        "focus:border-primary/45 focus:bg-paper focus:ring-2 focus:ring-primary/10",
        "disabled:cursor-not-allowed disabled:bg-surface/60 disabled:text-ink-muted",
        className,
      )}
      {...props}
    />
  );
});
