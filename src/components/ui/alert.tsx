import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneClassName: Record<AlertTone, string> = {
  info: "border-primary-line bg-primary-soft text-ink",
  success: "border-primary-line bg-primary-soft text-ink",
  warning: "border-line bg-surface-butter text-ink",
  danger: "border-red-200 bg-red-50 text-red-800",
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  heading?: ReactNode;
}

export function Alert({ tone = "info", heading, className, children, ...props }: AlertProps) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3 shadow-soft", toneClassName[tone], className)} {...props}>
      {heading ? <p className="text-sm font-semibold">{heading}</p> : null}
      {children ? <div className={cn(heading && "mt-1", "text-sm")}>{children}</div> : null}
    </div>
  );
}
