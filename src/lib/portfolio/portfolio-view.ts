import { cache } from "react";
import {
  getPortfolioEntryDetailData,
  getPortfolioListingData,
  type PortfolioEntryDetailData,
  type PortfolioEntryRow,
  type PortfolioEvaluationRow,
  type PortfolioMilestoneRow,
  type PortfolioProjectRow,
  type PortfolioRecommendationRow,
  type PortfolioRoadmapRow,
  type PortfolioStatusOverride,
  type PortfolioSubmissionRow,
} from "@/lib/db/queries/portfolio";
import {
  ensurePortfolioEntriesForUserProjects,
  ensurePortfolioEntryForProject,
} from "@/lib/db/mutations/portfolio";
import { runFirstTimePortfolioCurationForPendingEntries } from "@/lib/portfolio/curation";
import type { ProjectTrack } from "@/types/domain";

export type PortfolioStatus = "in_progress" | "paused" | "completed" | "abandoned";

export interface PortfolioCachedCommitView {
  sha: string;
  shortSha: string;
  title: string;
  body: string;
  authorName: string;
  authoredAt: string | null;
}

export interface PortfolioListingEntryView {
  entry: PortfolioEntryRow;
  project: PortfolioProjectRow;
  projectTrack: ProjectTrack;
  effectiveStatus: PortfolioStatus;
  statusLabel: string;
  summary: string;
  hasCuratedSummary: boolean;
  completedMilestones: number;
  totalMilestones: number;
  completionPercent: number;
  selectedAt: string | null;
  updatedAt: string | null;
}

export interface PortfolioView {
  entries: PortfolioListingEntryView[];
  counts: Record<PortfolioStatus | "all", number>;
}

export interface PortfolioEntryDetailView {
  entry: PortfolioEntryRow;
  project: PortfolioProjectRow;
  projectTrack: ProjectTrack;
  effectiveStatus: PortfolioStatus;
  statusLabel: string;
  summary: string;
  hasCuratedSummary: boolean;
  roadmap: PortfolioRoadmapRow | null;
  recommendation: PortfolioRecommendationRow | null;
  milestones: PortfolioMilestoneRow[];
  latestSubmissions: PortfolioSubmissionRow[];
  latestEvaluations: PortfolioEvaluationRow[];
  featuredSubmission: PortfolioSubmissionRow | null;
  reviews: PortfolioEntryDetailData["reviews"];
  cachedCommits: PortfolioCachedCommitView[];
  exports: PortfolioEntryDetailData["exports"];
  publicPage: PortfolioEntryDetailData["publicPage"];
  completedMilestones: number;
  totalMilestones: number;
  completionPercent: number;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function compactText(value: string, maxLength: number): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  const sliced = cleaned.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  const cut = lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced;
  return `${cut.trim()}...`;
}

function asProjectTrack(value: unknown): ProjectTrack {
  return value === "research" ? "research" : "software";
}

function isPortfolioStatusOverride(value: unknown): value is PortfolioStatusOverride {
  return value === "in_progress" || value === "paused" || value === "completed" || value === "abandoned";
}

function normalizeProjectStatus(projectStatus: unknown): PortfolioStatus {
  if (projectStatus === "completed") return "completed";
  if (projectStatus === "paused") return "paused";
  if (projectStatus === "archived") return "abandoned";
  return "in_progress";
}

function getEffectiveStatus(entry: PortfolioEntryRow, project: PortfolioProjectRow): PortfolioStatus {
  return isPortfolioStatusOverride(entry.status_override)
    ? entry.status_override
    : normalizeProjectStatus(project.status);
}

export function getPortfolioStatusLabel(status: PortfolioStatus): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "paused":
      return "Paused";
    case "abandoned":
      return "Cut";
    case "in_progress":
      return "In Progress";
  }
}

function summarizePortfolioEntry(input: {
  entry: PortfolioEntryRow;
  roadmap: PortfolioRoadmapRow | null;
  recommendation: PortfolioRecommendationRow | null;
}) {
  const curated = cleanString(input.entry.curated_summary);
  if (curated.length > 0) {
    return { summary: compactText(curated, 320), hasCuratedSummary: true };
  }

  const roadmapOverview = cleanString(input.roadmap?.overview);
  if (roadmapOverview.length > 0) {
    return { summary: compactText(roadmapOverview, 320), hasCuratedSummary: false };
  }

  const recommendationSummary = cleanString(input.recommendation?.summary);
  if (recommendationSummary.length > 0) {
    return { summary: compactText(recommendationSummary, 320), hasCuratedSummary: false };
  }

  return {
    summary: "Portfolio curation has not run yet. This entry is ready for the first generated summary.",
    hasCuratedSummary: false,
  };
}

function summarizeProgress(milestones: PortfolioMilestoneRow[]) {
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((milestone) => milestone.completed).length;
  const completionPercent =
    totalMilestones === 0 ? 0 : Math.round((completedMilestones / totalMilestones) * 100);

  return { completedMilestones, totalMilestones, completionPercent };
}

function mapByProjectId<T extends { project_id: string }>(rows: T[]) {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(row.project_id, row);
  }
  return map;
}

function groupByProjectId<T extends { project_id: string }>(rows: T[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const existing = map.get(row.project_id) ?? [];
    existing.push(row);
    map.set(row.project_id, existing);
  }
  return map;
}

function latestEvaluationBySubmissionId(evaluations: PortfolioEvaluationRow[]) {
  const map = new Map<string, PortfolioEvaluationRow>();
  for (const evaluation of evaluations) {
    if (!map.has(evaluation.submission_id)) {
      map.set(evaluation.submission_id, evaluation);
    }
  }
  return map;
}

function getStringField(value: unknown, key: string): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : "";
}

function summarizeCachedCommits(cachedCommits: unknown): PortfolioCachedCommitView[] {
  if (!Array.isArray(cachedCommits)) {
    return [];
  }

  return cachedCommits
    .map((commit): PortfolioCachedCommitView | null => {
      if (!commit || typeof commit !== "object") {
        return null;
      }

      const record = commit as Record<string, unknown>;
      const sha = cleanString(record.sha);
      if (sha.length === 0) {
        return null;
      }

      return {
        sha,
        shortSha: cleanString(record.short_sha) || sha.slice(0, 7),
        title: cleanString(record.message_title) || compactText(cleanString(record.message), 96),
        body: cleanString(record.message_body),
        authorName: getStringField(record.author, "name"),
        authoredAt: getStringField(record.author, "date") || null,
      };
    })
    .filter((commit): commit is PortfolioCachedCommitView => commit !== null)
    .slice(0, 20);
}

function buildPortfolioEntryDetailViewFromData(data: PortfolioEntryDetailData): PortfolioEntryDetailView {
  const effectiveStatus = getEffectiveStatus(data.entry, data.project);
  const summary = summarizePortfolioEntry({
    entry: data.entry,
    roadmap: data.roadmap,
    recommendation: data.recommendation,
  });
  const progress = summarizeProgress(data.milestones);
  const evaluationBySubmission = latestEvaluationBySubmissionId(data.latestEvaluations);
  const latestEvaluations = data.latestSubmissions
    .map((submission) => evaluationBySubmission.get(submission.id) ?? null)
    .filter((evaluation): evaluation is PortfolioEvaluationRow => evaluation !== null);
  const featuredSubmission =
    data.entry.featured_submission_id
      ? data.latestSubmissions.find((submission) => submission.id === data.entry.featured_submission_id) ?? null
      : null;

  return {
    entry: data.entry,
    project: data.project,
    projectTrack: asProjectTrack(data.project.project_track),
    effectiveStatus,
    statusLabel: getPortfolioStatusLabel(effectiveStatus),
    summary: summary.summary,
    hasCuratedSummary: summary.hasCuratedSummary,
    roadmap: data.roadmap,
    recommendation: data.recommendation,
    milestones: data.milestones,
    latestSubmissions: data.latestSubmissions,
    latestEvaluations,
    featuredSubmission,
    reviews: data.reviews,
    cachedCommits: summarizeCachedCommits(data.githubActivity?.cached_commits),
    exports: data.exports,
    publicPage: data.publicPage,
    ...progress,
  };
}

function buildListingEntry(input: {
  project: PortfolioProjectRow;
  entry: PortfolioEntryRow;
  roadmap: PortfolioRoadmapRow | null;
  recommendation: PortfolioRecommendationRow | null;
  milestones: PortfolioMilestoneRow[];
}): PortfolioListingEntryView {
  const effectiveStatus = getEffectiveStatus(input.entry, input.project);
  const summary = summarizePortfolioEntry(input);
  const progress = summarizeProgress(input.milestones);

  return {
    entry: input.entry,
    project: input.project,
    projectTrack: asProjectTrack(input.project.project_track),
    effectiveStatus,
    statusLabel: getPortfolioStatusLabel(effectiveStatus),
    summary: summary.summary,
    hasCuratedSummary: summary.hasCuratedSummary,
    ...progress,
    selectedAt: input.project.selected_at ?? null,
    updatedAt: input.entry.updated_at ?? input.project.updated_at ?? null,
  };
}

function buildCounts(entries: PortfolioListingEntryView[]): PortfolioView["counts"] {
  return entries.reduce<PortfolioView["counts"]>(
    (counts, entry) => {
      counts.all += 1;
      counts[entry.effectiveStatus] += 1;
      return counts;
    },
    {
      all: 0,
      in_progress: 0,
      paused: 0,
      completed: 0,
      abandoned: 0,
    },
  );
}

function buildPortfolioViewFromData(data: Awaited<ReturnType<typeof getPortfolioListingData>>): PortfolioView {
  const entryByProjectId = mapByProjectId(data.entries);
  const roadmapByProjectId = mapByProjectId(data.roadmaps);
  const milestoneByProjectId = groupByProjectId(data.milestones);
  const recommendationById = new Map(data.recommendations.map((recommendation) => [recommendation.id, recommendation]));

  const entries = data.projects
    .map((project) => {
      const entry = entryByProjectId.get(project.id);
      if (!entry) {
        return null;
      }

      return buildListingEntry({
        project,
        entry,
        roadmap: roadmapByProjectId.get(project.id) ?? null,
        recommendation: recommendationById.get(project.recommendation_id) ?? null,
        milestones: milestoneByProjectId.get(project.id) ?? [],
      });
    })
    .filter((entry): entry is PortfolioListingEntryView => entry !== null);

  return {
    entries,
    counts: buildCounts(entries),
  };
}

export const getPortfolioView = cache(async (userId: string): Promise<PortfolioView> => {
  await ensurePortfolioEntriesForUserProjects(userId);

  const initialData = await getPortfolioListingData(userId);
  const initialView = buildPortfolioViewFromData(initialData);
  const pendingFirstCuration = initialView.entries.filter(
    (entry) => !entry.entry.curation_attempted_at && !entry.entry.curated_summary,
  );

  if (pendingFirstCuration.length > 0) {
    await runFirstTimePortfolioCurationForPendingEntries({
      userId,
      entries: pendingFirstCuration,
    });

    return buildPortfolioViewFromData(await getPortfolioListingData(userId));
  }

  return initialView;
});

export const getPortfolioEntryDetailView = cache(
  async (projectId: string, userId: string): Promise<PortfolioEntryDetailView | null> => {
    const ensuredEntry = await ensurePortfolioEntryForProject(projectId, userId);
    if (!ensuredEntry) {
      return null;
    }

    const data = await getPortfolioEntryDetailData(projectId, userId);
    if (!data) {
      return null;
    }

    if (!data.entry.curation_attempted_at && !data.entry.curated_summary) {
      await runFirstTimePortfolioCurationForPendingEntries({
        userId,
        entries: [{ entry: data.entry, project: { id: data.project.id } }],
      });

      const refreshedData = await getPortfolioEntryDetailData(projectId, userId);
      if (refreshedData) {
        return buildPortfolioEntryDetailViewFromData(refreshedData);
      }
    }

    return buildPortfolioEntryDetailViewFromData(data);
  },
);
