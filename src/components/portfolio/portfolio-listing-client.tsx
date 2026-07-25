"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getTrackLabel } from "@/components/theme/theme-utils";
import type { PortfolioListingEntryView, PortfolioStatus } from "@/lib/portfolio/portfolio-view";
import { cn } from "@/lib/utils";

type PortfolioTab = "all" | PortfolioStatus;

const tabs: Array<{ value: PortfolioTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In Progress" },
  { value: "paused", label: "Paused" },
  { value: "abandoned", label: "Cut projects" },
];

function formatDate(value: string | null) {
  if (!value) return "No date yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date yet";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status: PortfolioStatus): "neutral" | "success" | "warning" {
  if (status === "completed") return "success";
  if (status === "paused" || status === "abandoned") return "warning";
  return "neutral";
}

function matchesSearch(entry: PortfolioListingEntryView, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  return [
    entry.project.title,
    entry.projectTrack,
    getTrackLabel(entry.projectTrack),
    entry.summary,
  ].some((value) => value.toLowerCase().includes(needle));
}

export function PortfolioListingClient({ entries }: { entries: PortfolioListingEntryView[] }) {
  const [activeTab, setActiveTab] = useState<PortfolioTab>("completed");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    return entries.reduce<Record<PortfolioTab, number>>(
      (next, entry) => {
        next.all += 1;
        next[entry.effectiveStatus] += 1;
        return next;
      },
      { all: 0, completed: 0, in_progress: 0, paused: 0, abandoned: 0 },
    );
  }, [entries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesTab = activeTab === "all" || entry.effectiveStatus === activeTab;
      return matchesTab && matchesSearch(entry, query);
    });
  }, [activeTab, entries, query]);

  const hasEntries = entries.length > 0;

  return (
    <div className="space-y-8">
      <Card>
        <PageHeader
          eyebrow="Private Portfolio"
          title="Your project record, organized by what happened."
          description="Completed, active, paused, and cut projects stay visible here without needing public sharing."
          actions={
            <Button href="/recommendations">
              Add project
            </Button>
          }
          className="border-b-0 pb-0"
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <PortfolioMetric label="Total projects" value={counts.all} />
        <PortfolioMetric label="Completed" value={counts.completed} />
        <PortfolioMetric label="In progress" value={counts.in_progress} />
        <PortfolioMetric label="Paused or cut" value={counts.paused + counts.abandoned} />
      </div>

      <Card className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <label htmlFor="portfolio-search" className="text-sm font-semibold text-ink">
              Search Portfolio
            </label>
            <Input
              id="portfolio-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, track, or summary"
            />
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Portfolio status filters">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.value)}
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition",
                    isActive
                      ? "border-line-strong bg-ink text-paper"
                      : "border-line bg-paper text-ink-soft hover:border-line-strong hover:text-ink",
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn("text-xs", isActive ? "text-paper/72" : "text-ink-muted")}>
                    {counts[tab.value]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredEntries.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredEntries.map((entry) => (
              <PortfolioEntryCard key={entry.entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <PortfolioEmptyState hasEntries={hasEntries} activeTab={activeTab} query={query} />
        )}
      </Card>
    </div>
  );
}

function PortfolioMetric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="editorial-kicker">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-ink">{value}</p>
    </Card>
  );
}

function PortfolioEntryCard({ entry }: { entry: PortfolioListingEntryView }) {
  return (
    <Card tone="subtle" className="flex h-full flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone={entry.projectTrack === "software" ? "software" : "research"}>
            {getTrackLabel(entry.projectTrack)}
          </Badge>
          <Badge tone={statusTone(entry.effectiveStatus)}>{entry.statusLabel}</Badge>
          {entry.hasCuratedSummary ? <Badge tone="accent">Curated</Badge> : null}
        </div>
        <span className="text-xs text-ink-muted">Updated {formatDate(entry.updatedAt)}</span>
      </div>

      <div className="space-y-3">
        <h2 className="text-2xl font-semibold text-ink">{entry.project.title}</h2>
        {/* Clamped visually rather than cut, so the stored summary stays whole. */}
        <p className="line-clamp-4 text-sm leading-6 text-ink-soft">{entry.summary}</p>
      </div>

      <ProgressBar
        value={entry.completionPercent}
        label="Project progress"
        helperText={`${entry.completedMilestones} of ${entry.totalMilestones} project steps complete`}
      />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2">
        <span className="text-xs text-ink-muted">Selected {formatDate(entry.selectedAt)}</span>
        <Button href={`/portfolio/${entry.project.id}`} variant="outline">
          Open entry
        </Button>
      </div>
    </Card>
  );
}

function PortfolioEmptyState({
  hasEntries,
  activeTab,
  query,
}: {
  hasEntries: boolean;
  activeTab: PortfolioTab;
  query: string;
}) {
  if (!hasEntries) {
    return (
      <Card tone="subtle" className="space-y-4">
        <h2 className="text-xl font-semibold text-ink">No projects in your Portfolio yet.</h2>
        <p className="text-sm leading-6 text-ink-soft">
          Save a project from the idea board, build the roadmap, and Portfolio will start keeping the record.
        </p>
        <div>
          <Button href="/recommendations">
            Open ideas
          </Button>
        </div>
      </Card>
    );
  }

  if (query.trim().length > 0) {
    return (
      <Card tone="subtle">
        <p className="text-sm leading-6 text-ink-soft">
          No Portfolio entries match that search. Try a project title, track, or a phrase from the summary.
        </p>
      </Card>
    );
  }

  const copy =
    activeTab === "completed"
      ? "Completed projects will appear here once a project is marked complete. Use All to see work already in progress."
      : activeTab === "abandoned"
        ? "Cut projects will appear here when archived projects are normalized into the Portfolio record."
        : "No projects match this status yet. Use All to see the rest of your private Portfolio.";

  return (
    <Card tone="subtle">
      <p className="text-sm leading-6 text-ink-soft">{copy}</p>
    </Card>
  );
}
