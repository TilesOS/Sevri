import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-9 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink placeholder:text-ink-muted outline-none transition-colors",
          "focus:border-primary/50 focus:bg-paper focus:ring-2 focus:ring-primary/10",
          "disabled:cursor-not-allowed disabled:bg-surface/60 disabled:text-ink-muted",
          className,
        )}
        {...props}
      />
    );
  },
);
