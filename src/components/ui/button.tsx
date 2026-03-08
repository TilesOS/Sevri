import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-ink-900 text-surface-card hover:bg-ink-800",
  secondary: "bg-surface-card text-ink-800 border border-surface-border hover:bg-surface-subtle",
  ghost: "bg-transparent text-ink-700 hover:bg-surface-subtle",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variantClass[variant],
        className,
      )}
      {...props}
    />
  );
});
