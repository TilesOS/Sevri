"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import type { GithubActivityResponse } from "@/components/project/github-overview-card";

interface GithubStepCommitsProps {
  projectId: string;
  milestoneId: string;
}

function formatRelative(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

export function GithubStepCommits({ projectId, milestoneId }: GithubStepCommitsProps) {
  const [activity, setActivity] = useState<GithubActivityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    fetch(`/api/projects/${projectId}/github/activity`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`activity ${res.status}`);
        return (await res.json()) as GithubActivityResponse;
      })
      .then((payload) => {
        if (!cancelled) setActivity(payload);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, milestoneId]);

  if (errored) return null;

  const shas = new Set(activity?.attribution[milestoneId] ?? []);
  const commits = (activity?.commits ?? []).filter((c) => shas.has(c.sha));

  return (
    <Card className="space-y-3">
      <details className="group" open>
        <summary
          className="flex cursor-pointer items-center justify-between gap-3 list-none [&::-webkit-details-marker]:hidden"
          title="Commits are bucketed by the date they were authored relative to when each step was active. Messages are not parsed."
        >
          <div>
            <p className="editorial-kicker">GitHub commits</p>
            <p className="mt-1 text-sm text-ink-soft">
              Commits attributed to this step
            </p>
          </div>
          <span className="text-xs text-ink-muted transition group-open:rotate-180">▾</span>
        </summary>
        <div className="mt-3">
          {loading && commits.length === 0 ? (
            <p className="text-xs text-ink-muted">Loading…</p>
          ) : commits.length === 0 ? (
            <p className="text-sm text-ink-soft">
              No commits authored while this step was active yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {commits.map((c) => (
                <li key={c.sha} className="flex items-start gap-2 text-xs leading-5">
                  {c.author.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.author.avatar_url}
                      alt=""
                      className="mt-0.5 h-4 w-4 rounded-full"
                    />
                  ) : null}
                  <Link
                    href={c.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-ink-muted hover:underline"
                  >
                    {c.short_sha}
                  </Link>
                  <span className="flex-1 truncate text-ink-soft">{c.message_title}</span>
                  <span className="text-ink-muted">{formatRelative(c.author.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </Card>
  );
}
