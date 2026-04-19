"use client";

import { useMemo, useState } from "react";
import { diffLines } from "diff";

import { Card } from "@/components/ui/card";

interface ReadmeDiffSectionProps {
  cachedReadme: string;
  readmeDraft: string;
}

export function ReadmeDiffSection({ cachedReadme, readmeDraft }: ReadmeDiffSectionProps) {
  const [open, setOpen] = useState(false);
  const parts = useMemo(
    () => diffLines(cachedReadme.trim(), readmeDraft.trim()),
    [cachedReadme, readmeDraft],
  );

  return (
    <Card className="space-y-4">
      <div>
        <p className="editorial-kicker">Your repo README is out of date vs. your Sevri draft.</p>
        <p className="mt-1 text-sm text-ink-soft">
          Pick one source of truth — or keep them in sync manually.
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium text-ink hover:underline"
      >
        {open ? "Hide diff" : "Show diff"}
      </button>
      {open ? (
        <pre className="overflow-x-auto rounded-2xl bg-canvas p-4 text-xs leading-5">
          {parts.map((part, idx) => {
            const cls = part.added
              ? "block bg-green-100 text-green-900"
              : part.removed
                ? "block bg-red-100 text-red-900"
                : "block text-ink-soft";
            const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
            return (
              <span key={idx} className={cls}>
                {part.value
                  .split("\n")
                  .map((line, lineIdx, arr) =>
                    lineIdx === arr.length - 1 && line === ""
                      ? null
                      : `${prefix}${line}\n`,
                  )
                  .join("")}
              </span>
            );
          })}
        </pre>
      ) : null}
    </Card>
  );
}
