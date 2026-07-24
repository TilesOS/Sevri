import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-[10px] border border-line bg-paper px-3 text-sm text-ink shadow-[inset_0_1px_0_rgba(32,32,29,0.015)] placeholder:text-ink-muted outline-none transition-[background-color,border-color,box-shadow]",
          "focus:border-primary/45 focus:bg-paper focus:ring-2 focus:ring-primary/10",
          "disabled:cursor-not-allowed disabled:bg-surface/60 disabled:text-ink-muted",
          className,
        )}
        {...props}
      />
    );
  },
);
