"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { ProjectGithubLinkView } from "@/lib/projects/workspace";
import type { UserIntegrationPublicRow } from "@/lib/db/queries/github";
import type { Plan } from "@/types/domain";

export interface GithubActivityCommit {
  sha: string;
  short_sha: string;
  message_title: string;
  message_body: string;
  author: { name: string; date: string; avatar_url: string | null };
  html_url: string;
}

export interface GithubActivityResponse {
  commits: GithubActivityCommit[];
  attribution: Record<string, string[]>;
  readme: { content: string; sha: string } | null;
  last_synced_at: string;
  stale?: true;
}

interface GithubOverviewCardProps {
  projectId: string;
  plan: Plan;
  integration: UserIntegrationPublicRow | null;
  link: ProjectGithubLinkView | null;
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

export function GithubOverviewCard({
  projectId,
  plan,
  integration,
  link,
}: GithubOverviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<GithubActivityResponse | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [repoInput, setRepoInput] = useState("");
  const [linking, setLinking] = useState(false);

  const isPro = plan === "pro_monthly";
  const connected = integration !== null;
  const tokenInvalid = integration?.status === "invalid";

  useEffect(() => {
    if (!link || link.status !== "active") return;
    let cancelled = false;
    setActivityLoading(true);
    fetch(`/api/projects/${projectId}/github/activity`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`activity ${res.status}`);
        }
        return (await res.json()) as GithubActivityResponse;
      })
      .then((payload) => {
        if (!cancelled) setActivity(payload);
      })
      .catch(() => {
        if (!cancelled) setActivity(null);
      })
      .finally(() => {
        if (!cancelled) setActivityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [link, projectId]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(repoInput.trim())) {
      setError("Use the form owner/repo (e.g., octocat/hello-world).");
      return;
    }
    setLinking(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/github/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_full_name: repoInput.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: string; message?: string; error?: string };
        setError(body.message ?? body.error ?? "Could not link repository.");
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink() {
    if (!confirm("Unlink this repository from the project?")) return;
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/github/link`, { method: "DELETE" });
    if (!res.ok) {
      setError("Could not unlink. Try again.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (!connected) {
    return (
      <Card className="space-y-3">
        <p className="editorial-kicker">GitHub</p>
        <p className="text-sm leading-6 text-ink-soft">Connect GitHub to track your commits.</p>
        <Button href="/settings/integrations" variant="primary" size="sm">
          Connect GitHub
        </Button>
      </Card>
    );
  }

  if (tokenInvalid) {
    return (
      <Card className="space-y-3 border-amber-300 bg-amber-50">
        <p className="editorial-kicker">GitHub</p>
        <p className="text-sm leading-6 text-ink-soft">Reconnect GitHub to resume syncing.</p>
        <Button href="/settings/integrations" variant="primary" size="sm">
          Reconnect
        </Button>
      </Card>
    );
  }

  if (!link) {
    if (!isPro) {
      return (
        <Card className="space-y-3">
          <p className="editorial-kicker">GitHub</p>
          <p className="text-sm leading-6 text-ink-soft">
            Linking a repo is a Pro feature.
          </p>
          <Button href="/billing" size="sm">
            Upgrade to Pro
          </Button>
        </Card>
      );
    }
    return (
      <Card className="space-y-3">
        <p className="editorial-kicker">GitHub</p>
        <p className="text-sm leading-6 text-ink-soft">
          Link a public repository to this project.
        </p>
        <form className="space-y-2" onSubmit={handleLink}>
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="owner/repo"
            className="w-full rounded-xl border border-ink-line bg-paper px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
            disabled={linking || isPending}
          />
          <Button type="submit" size="sm" disabled={linking || isPending || !repoInput.trim()}>
            {linking ? "Linking..." : "Link repo"}
          </Button>
        </form>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </Card>
    );
  }

  if (link.status === "broken") {
    return (
      <Card className="space-y-3 border-amber-300 bg-amber-50">
        <p className="editorial-kicker">GitHub</p>
        <p className="text-sm leading-6 text-ink-soft">
          Your linked repo (<code>{link.repo_full_name}</code>) is no longer reachable. It may have been
          deleted or made private.
        </p>
        <div className="flex gap-2">
          <Button onClick={handleUnlink} variant="outline" size="sm">
            Unlink
          </Button>
        </div>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </Card>
    );
  }

  const commits = activity?.commits.slice(0, 10) ?? [];

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="editorial-kicker">GitHub</p>
          <p className="text-sm leading-6 text-ink-soft">
            <Link
              href={`https://github.com/${link.repo_full_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline"
            >
              {link.repo_full_name}
            </Link>
          </p>
        </div>
        <Button onClick={handleUnlink} variant="outline" size="sm">
          Unlink
        </Button>
      </div>

      {activityLoading && commits.length === 0 ? (
        <p className="text-xs text-ink-muted">Loading commits…</p>
      ) : commits.length === 0 ? (
        <p className="text-xs text-ink-muted">No commits yet on the default branch.</p>
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

      {activity ? (
        <p className="text-[11px] text-ink-muted">
          Last synced {formatRelative(activity.last_synced_at)}
          {activity.stale ? " · showing last synced data" : ""}
        </p>
      ) : null}

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </Card>
  );
}
