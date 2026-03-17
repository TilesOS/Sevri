"use client";

import { cn } from "@/lib/utils";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label={label}>
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-xl border px-4 py-4 text-left transition",
                isActive
                  ? "border-line-strong bg-paper"
                  : "border-line bg-paper/60 hover:border-line-strong hover:bg-paper",
              )}
            >
              <p className="text-sm font-semibold text-ink">{option.label}</p>
              {option.description ? <p className="mt-1 text-xs leading-5 text-ink-muted">{option.description}</p> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
