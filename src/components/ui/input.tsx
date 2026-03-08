import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-md border border-surface-border bg-surface-card px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-ink-400 focus:ring-2 focus:ring-ink-200",
          className,
        )}
        {...props}
      />
    );
  },
);
