import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-line bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-muted outline-none transition",
          "focus:border-line-strong focus:bg-paper",
          "disabled:cursor-not-allowed disabled:bg-surface/60 disabled:text-ink-muted",
          className,
        )}
        {...props}
      />
    );
  },
);
