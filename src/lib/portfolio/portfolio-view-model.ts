// Pure view-model builders for the Portfolio surfaces.
//
// No I/O and no runtime imports from other modules, so these can be unit tested
// directly against production-shaped rows. src/lib/portfolio/portfolio-view.ts
// owns the data fetching and re-exports everything here.

import type {
  PortfolioEntryDetailData,
  PortfolioEntryRow,
  PortfolioEvaluationRow,
  PortfolioListingData,
  PortfolioMilestoneRow,
  PortfolioProjectRow,
  PortfolioRecommendationRow,
  PortfolioRoadmapRow,
  PortfolioStatusOverride,
  PortfolioSubmissionRow,
} from "@/lib/db/queries/portfolio";
import { getProjectProgressPercent } from "../projects/progress.ts";
import { normalizeWhitespace, stripZeroWidth } from "../text/prose.ts";

export type PortfolioStatus = "in_progress" | "paused" | "completed" | "abandoned";

/**
 * Why an entry does or does not have a generated summary.
 * - `curated`  — a summary is stored.
 * - `pending`  — curation has not been attempted yet.
 * - `failed`   — curation was attempted and produced nothing.
 * - `blocked`  — curation was withheld by a safety check.
 */
export type PortfolioCurationState = "curated" | "pending" | "failed" | "blocked";

/** How long to wait before a failed first-time curation is retried. */
export const FIRST_TIME_CURATION_RETRY_COOLDOWN_MS = 60 * 60 * 1000;

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
  projectKindLabel: string;
  effectiveStatus: PortfolioStatus;
  statusLabel: string;
  summary: string;
  hasCuratedSummary: boolean;
  curationState: PortfolioCurationState;
  completedMilestones: number;
  totalMilestones: number;
  completionPercent: number;
  selectedAt: string | null;
  updatedAt: string | null;
}

export interface PortfolioView {
  entries: PortfolioListingEntryView[];
  counts: Record<PortfolioStatus | "all", number>;
  pendingCurationCount: number;
}

export interface PortfolioEntryDetailView {
  entry: PortfolioEntryRow;
  project: PortfolioProjectRow;
  projectKindLabel: string;
  effectiveStatus: PortfolioStatus;
  statusLabel: string;
  summary: string;
  hasCuratedSummary: boolean;
  curationState: PortfolioCurationState;
  roadmap: PortfolioRoadmapRow | null;
  recommendation: PortfolioRecommendationRow | null;
  milestones: PortfolioMilestoneRow[];
  latestSubmissions: PortfolioSubmissionRow[];
  latestEvaluations: PortfolioEvaluationRow[];
  artifacts: PortfolioEntryDetailData["artifacts"];
  featuredArtifactIds: string[];
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

/**
 * Normalizes whitespace without shortening. Summaries are shown in full and
 * clamped with CSS where the layout is tight — cutting the string here is what
 * produced stored-looking fragments such as "Limitation: the study".
 */
function tidyText(value: string): string {
  return stripZeroWidth(value).replace(/\s+/g, " ").trim();
}

/** Commit subjects are a single line by construction; a long one is elided visually. */
function firstLine(value: string): string {
  const [line = ""] = stripZeroWidth(value).split(/\r?\n/u);
  return normalizeWhitespace(line);
}

function isPortfolioStatusOverride(value: unknown): value is PortfolioStatusOverride {
  return value === "in_progress" || value === "paused" || value === "completed" || value === "abandoned";
}

function normalizeProjectStatus(projectStatus: unknown, archivedAt: unknown): PortfolioStatus {
  if (typeof archivedAt === "string" && archivedAt.length > 0) return "abandoned";
  if (projectStatus === "completed") return "completed";
  if (projectStatus === "paused") return "paused";
  return "in_progress";
}

function getEffectiveStatus(entry: PortfolioEntryRow, project: PortfolioProjectRow): PortfolioStatus {
  return isPortfolioStatusOverride(entry.status_override)
    ? entry.status_override
    : normalizeProjectStatus(project.status, project.archived_at);
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

export function getPortfolioCurationState(entry: PortfolioEntryRow): PortfolioCurationState {
  if (cleanString(entry.curated_summary).length > 0) {
    return "curated";
  }

  if (!cleanString(entry.curation_attempted_at)) {
    return "pending";
  }

  const metadata = (entry.curation_metadata_json ?? {}) as Record<string, unknown>;
  return metadata.blocked === true ? "blocked" : "failed";
}

/**
 * First-time curation runs for entries that have never been attempted, and
 * retries entries whose attempt failed once the cooldown has passed — a single
 * transient failure should not leave an entry permanently un-curated. Entries
 * held back by a safety check are never retried automatically.
 */
export function isEligibleForFirstTimeCuration(
  entry: PortfolioEntryRow,
  now: number = Date.now(),
): boolean {
  const state = getPortfolioCurationState(entry);
  if (state === "curated" || state === "blocked") {
    return false;
  }

  if (state === "pending") {
    return true;
  }

  const attemptedAt = Date.parse(cleanString(entry.curation_attempted_at));
  if (Number.isNaN(attemptedAt)) {
    return true;
  }

  return now - attemptedAt >= FIRST_TIME_CURATION_RETRY_COOLDOWN_MS;
}

function getMissingSummaryCopy(state: PortfolioCurationState): string {
  switch (state) {
    case "failed":
      return "A generated summary is not available for this entry yet. Your work is saved — regenerate it, or wait for the next automatic attempt.";
    case "blocked":
      return "A generated summary is on hold for this entry until its text passes the publishing safety check.";
    default:
      return "Portfolio curation has not run yet. This entry is ready for the first generated summary.";
  }
}

function summarizePortfolioEntry(input: {
  entry: PortfolioEntryRow;
  roadmap: PortfolioRoadmapRow | null;
  recommendation: PortfolioRecommendationRow | null;
}) {
  const curationState = getPortfolioCurationState(input.entry);
  const curated = cleanString(input.entry.curated_summary);
  if (curated.length > 0) {
    return { summary: tidyText(curated), hasCuratedSummary: true, curationState };
  }

  const roadmapOverview = cleanString(input.roadmap?.overview);
  if (roadmapOverview.length > 0) {
    return { summary: tidyText(roadmapOverview), hasCuratedSummary: false, curationState };
  }

  const recommendationSummary = cleanString(input.recommendation?.summary);
  if (recommendationSummary.length > 0) {
    return { summary: tidyText(recommendationSummary), hasCuratedSummary: false, curationState };
  }

  return {
    summary: getMissingSummaryCopy(curationState),
    hasCuratedSummary: false,
    curationState,
  };
}

/**
 * Portfolio reports the same number as every other surface: it defers to the
 * shared step-completion calculator rather than deriving its own percentage.
 */
function summarizeProgress(milestones: PortfolioMilestoneRow[]) {
  const totalMilestones = milestones.length;
  const completedMilestones = milestones.filter((milestone) => milestone.completed).length;

  return {
    completedMilestones,
    totalMilestones,
    completionPercent: getProjectProgressPercent(completedMilestones, totalMilestones),
  };
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
        title: cleanString(record.message_title) || firstLine(cleanString(record.message)),
        body: cleanString(record.message_body),
        authorName: getStringField(record.author, "name"),
        authoredAt: getStringField(record.author, "date") || null,
      };
    })
    .filter((commit): commit is PortfolioCachedCommitView => commit !== null)
    .slice(0, 20);
}

export function buildPortfolioEntryDetailViewFromData(
  data: PortfolioEntryDetailData,
): PortfolioEntryDetailView {
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
    projectKindLabel: cleanString(data.project.project_kind_label) || "Project",
    effectiveStatus,
    statusLabel: getPortfolioStatusLabel(effectiveStatus),
    summary: summary.summary,
    hasCuratedSummary: summary.hasCuratedSummary,
    curationState: summary.curationState,
    roadmap: data.roadmap,
    recommendation: data.recommendation,
    milestones: data.milestones,
    latestSubmissions: data.latestSubmissions,
    latestEvaluations,
    artifacts: data.artifacts,
    featuredArtifactIds: data.featuredArtifactIds,
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
    projectKindLabel: cleanString(input.project.project_kind_label) || "Project",
    effectiveStatus,
    statusLabel: getPortfolioStatusLabel(effectiveStatus),
    summary: summary.summary,
    hasCuratedSummary: summary.hasCuratedSummary,
    curationState: summary.curationState,
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

export function buildPortfolioViewFromData(data: PortfolioListingData): PortfolioView {
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
  const pendingCurationCount =
    data.projects.length -
    entries.length +
    entries.filter((entry) => isEligibleForFirstTimeCuration(entry.entry)).length;

  return {
    entries,
    counts: buildCounts(entries),
    pendingCurationCount,
  };
}
