import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "danger";

const toneClassName: Record<AlertTone, string> = {
  info: "border-line bg-paper text-ink",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-[#ddc575] bg-surface-butter text-ink",
  danger: "border-red-200 bg-red-50 text-red-800",
};

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  heading?: ReactNode;
}

export function Alert({ tone = "info", heading, className, children, ...props }: AlertProps) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", toneClassName[tone], className)} {...props}>
      {heading ? <p className="text-sm font-semibold">{heading}</p> : null}
      {children ? <div className={cn(heading && "mt-1", "text-sm")}>{children}</div> : null}
    </div>
  );
}
