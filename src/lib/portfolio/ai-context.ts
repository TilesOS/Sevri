import { buildRoadmapOverviewFromStorage } from "@/lib/ai/storage";
import type { PortfolioPipelineInput } from "@/lib/ai/pipelines";
import type { PortfolioEntryDetailData } from "@/lib/db/queries/portfolio";
import type { PortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";
import type { ProjectTrack } from "@/types/domain";

function asProjectTrack(value: unknown): ProjectTrack {
  return value === "research" ? "research" : "software";
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function effectiveStatus(projectStatus: string, override: string | null) {
  if (override === "in_progress" || override === "paused" || override === "completed" || override === "abandoned") {
    return override;
  }
  if (projectStatus === "completed") return "completed";
  if (projectStatus === "paused") return "paused";
  if (projectStatus === "archived") return "abandoned";
  return "in_progress";
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getStringField(value: unknown, key: string): string {
  if (!value || typeof value !== "object") {
    return "";
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : "";
}

function summarizeCachedCommits(cachedCommits: unknown): PortfolioPipelineInput["cachedCommits"] {
  if (!Array.isArray(cachedCommits)) {
    return [];
  }

  return cachedCommits
    .map((commit) => {
      if (!commit || typeof commit !== "object") {
        return null;
      }

      const record = commit as Record<string, unknown>;
      const sha = cleanString(record.sha);
      if (!sha) {
        return null;
      }

      return {
        sha,
        shortSha: cleanString(record.short_sha) || sha.slice(0, 7),
        title: cleanString(record.message_title) || cleanString(record.message) || sha.slice(0, 7),
        body: cleanString(record.message_body),
        authoredAt: getStringField(record.author, "date") || null,
      };
    })
    .filter((commit): commit is PortfolioPipelineInput["cachedCommits"][number] => commit !== null)
    .slice(0, 20);
}

export function buildPortfolioPipelineInputFromDetailData(data: PortfolioEntryDetailData): PortfolioPipelineInput {
  const roadmap = data.roadmap
    ? buildRoadmapOverviewFromStorage({
        projectTitle: data.project.title,
        roadmapOverview: data.roadmap.overview,
        trackPayloadJson: data.roadmap.track_payload_json,
        milestones: data.milestones.map((milestone) => ({
          order_index: milestone.order_index,
          title: milestone.title,
          description: milestone.description,
          objective: getString(milestone.objective),
          deliverable: getString(milestone.deliverable),
          rough_time_estimate: getString(milestone.rough_time_estimate),
        })),
      })
    : null;

  return {
    project: {
      title: data.project.title,
      status: effectiveStatus(data.project.status, data.entry.status_override),
      project_track: asProjectTrack(data.project.project_track),
    },
    roadmap,
    milestones: data.milestones.map((milestone) => ({
      id: milestone.id,
      order_index: milestone.order_index,
      title: milestone.title,
      description: milestone.description,
      completed: milestone.completed,
      completed_at: milestone.completed_at,
    })),
    submissions: data.latestSubmissions.map((submission) => ({
      id: submission.id,
      milestone_id: submission.milestone_id,
      submission_text: submission.submission_text,
      submission_filename: submission.submission_filename,
      created_at: submission.created_at,
    })),
    latestEvaluations: data.latestEvaluations.map((evaluation) => ({
      submission_id: evaluation.submission_id,
      evaluation_json: evaluation.evaluation_json,
      status: evaluation.status,
    })),
    reviews: data.reviews.map((review) => ({
      milestone_id: review.milestone_id,
      strength: review.strength,
      tighten: review.tighten,
      next_action: review.next_action,
      ready_to_mark_complete: review.ready_to_mark_complete,
    })),
    cachedCommits: summarizeCachedCommits(data.githubActivity?.cached_commits),
    existingReflection: data.entry.student_reflection,
    existingCuratedSummary: data.entry.curated_summary,
  };
}

export function buildPortfolioPipelineInput(view: PortfolioEntryDetailView): PortfolioPipelineInput {
  const roadmap = view.roadmap
    ? buildRoadmapOverviewFromStorage({
        projectTitle: view.project.title,
        roadmapOverview: view.roadmap.overview,
        trackPayloadJson: view.roadmap.track_payload_json,
        milestones: view.milestones.map((milestone) => ({
          order_index: milestone.order_index,
          title: milestone.title,
          description: milestone.description,
          objective: getString(milestone.objective),
          deliverable: getString(milestone.deliverable),
          rough_time_estimate: getString(milestone.rough_time_estimate),
        })),
      })
    : null;

  return {
    project: {
      title: view.project.title,
      status: view.effectiveStatus,
      project_track: asProjectTrack(view.project.project_track),
    },
    roadmap,
    milestones: view.milestones.map((milestone) => ({
      id: milestone.id,
      order_index: milestone.order_index,
      title: milestone.title,
      description: milestone.description,
      completed: milestone.completed,
      completed_at: milestone.completed_at,
    })),
    submissions: view.latestSubmissions.map((submission) => ({
      id: submission.id,
      milestone_id: submission.milestone_id,
      submission_text: submission.submission_text,
      submission_filename: submission.submission_filename,
      created_at: submission.created_at,
    })),
    latestEvaluations: view.latestEvaluations.map((evaluation) => ({
      submission_id: evaluation.submission_id,
      evaluation_json: evaluation.evaluation_json,
      status: evaluation.status,
    })),
    reviews: view.reviews.map((review) => ({
      milestone_id: review.milestone_id,
      strength: review.strength,
      tighten: review.tighten,
      next_action: review.next_action,
      ready_to_mark_complete: review.ready_to_mark_complete,
    })),
    cachedCommits: view.cachedCommits,
    existingReflection: view.entry.student_reflection,
    existingCuratedSummary: view.entry.curated_summary,
  };
}
