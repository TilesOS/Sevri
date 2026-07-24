import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneClassName: Record<AlertTone, string> = {
  info: "border-navy/10 bg-navy/[0.045] text-navy",
  success: "border-teal-deep/20 bg-teal/10 text-ink",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  danger: "border-red-200 bg-red-50 text-red-800",
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  heading?: ReactNode;
}

export function Alert({ tone = "info", heading, className, children, ...props }: AlertProps) {
  return (
    <div className={cn("rounded-xl border px-4 py-3.5", toneClassName[tone], className)} {...props}>
      {heading ? <p className="text-sm font-semibold">{heading}</p> : null}
      {children ? <div className={cn(heading && "mt-1", "text-sm")}>{children}</div> : null}
    </div>
  );
}
