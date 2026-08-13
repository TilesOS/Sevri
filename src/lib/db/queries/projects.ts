import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getProjectProgressSummary } from "@/lib/projects/progress";
import {
  countProjectCommits,
  countWords,
  emptyProjectOutputMetrics,
} from "@/lib/projects/output-metrics";

export async function getActiveProject(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "paused"])
    .is("archived_at", null)
    .order("selected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch active project: ${error.message}`);
  }

  return data;
}

/**
 * Archived projects, for the restore list. They are deliberately excluded from
 * every other dashboard and calendar query — archiving hides a project without
 * deleting anything, so this is the only place they surface.
 */
export async function getArchivedProjectsForDashboard(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, project_kind_label, selected_at")
    .eq("user_id", userId)
    .not("archived_at", "is", null)
    .order("selected_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch archived projects: ${error.message}`);
  }

  return data ?? [];
}

export async function getProjectsForDashboard(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: projects, error: projectError } = await supabase
    .from("projects")
    .select("id, title, status, project_kind_label, selected_at")
    .eq("user_id", userId)
    .in("status", ["active", "paused", "completed"])
    .is("archived_at", null)
    .order("selected_at", { ascending: false });

  if (projectError) {
    throw new Error(`Failed to fetch projects: ${projectError.message}`);
  }

  const projectIds = (projects ?? []).map((project) => project.id);
  let roadmapProjectIds = new Set<string>();
  let milestoneCountsByProjectId = new Map<string, { total: number; completed: number }>();
  let currentStepNumberByProjectId = new Map<string, number>();
  let outputMetricsByProjectId = new Map<string, ReturnType<typeof emptyProjectOutputMetrics>>();
  const projectById = new Map((projects ?? []).map((project) => [project.id, project]));

  if (projectIds.length > 0) {
    const [
      { data: roadmaps, error: roadmapError },
      { data: milestones, error: milestoneError },
      { data: githubLinks, error: githubLinksError },
    ] = await Promise.all([
      supabase
        .from("project_roadmaps")
        .select("project_id")
        .in("project_id", projectIds),
      supabase
        .from("milestones")
        .select("id, project_id, completed, order_index")
        .in("project_id", projectIds)
        .order("order_index", { ascending: true }),
      supabase
        .from("project_github_links")
        .select("project_id, cached_commits")
        .in("project_id", projectIds),
    ]);

    if (roadmapError) {
      throw new Error(`Failed to fetch roadmap summaries: ${roadmapError.message}`);
    }

    if (milestoneError) {
      throw new Error(`Failed to fetch milestone summaries: ${milestoneError.message}`);
    }

    if (githubLinksError) {
      throw new Error(`Failed to fetch GitHub activity summaries: ${githubLinksError.message}`);
    }

    roadmapProjectIds = new Set((roadmaps ?? []).map((roadmap) => roadmap.project_id));
    milestoneCountsByProjectId = (milestones ?? []).reduce((counts, milestone) => {
      const current = counts.get(milestone.project_id) ?? { total: 0, completed: 0 };
      current.total += 1;
      if (milestone.completed) {
        current.completed += 1;
      }
      counts.set(milestone.project_id, current);
      return counts;
    }, new Map<string, { total: number; completed: number }>());
    currentStepNumberByProjectId = (milestones ?? []).reduce((steps, milestone) => {
      if (!milestone.completed && !steps.has(milestone.project_id)) {
        steps.set(milestone.project_id, milestone.order_index + 1);
      }
      return steps;
    }, new Map<string, number>());

    outputMetricsByProjectId = (projects ?? []).reduce((metrics, project) => {
      metrics.set(project.id, emptyProjectOutputMetrics());
      return metrics;
    }, new Map<string, ReturnType<typeof emptyProjectOutputMetrics>>());

    for (const link of githubLinks ?? []) {
      const project = projectById.get(link.project_id);
      if (!project) continue;

      const current = outputMetricsByProjectId.get(project.id) ?? emptyProjectOutputMetrics();
      current.commitCount = countProjectCommits(link.cached_commits, project.selected_at);
      outputMetricsByProjectId.set(project.id, current);
    }

    const milestoneIds = (milestones ?? []).map((milestone) => milestone.id);
    if (milestoneIds.length > 0) {
      const { data: projectSubmissions, error: projectSubmissionsError } = await supabase
        .from("milestone_submissions")
        .select("id, milestone_id, submission_text, created_at")
        .in("milestone_id", milestoneIds)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });

      if (projectSubmissionsError) {
        throw new Error(`Failed to fetch submission summaries: ${projectSubmissionsError.message}`);
      }

      const projectIdByMilestoneId = new Map(
        (milestones ?? []).map((milestone) => [milestone.id, milestone.project_id]),
      );
      const latestSubmissionByMilestoneId = new Set<string>();

      const submissionProjectIds = new Map<string, string>();
      for (const submission of projectSubmissions ?? []) {
        const submissionProjectId = projectIdByMilestoneId.get(submission.milestone_id);
        if (submissionProjectId) submissionProjectIds.set(submission.id, submissionProjectId);
        if (latestSubmissionByMilestoneId.has(submission.milestone_id)) continue;
        latestSubmissionByMilestoneId.add(submission.milestone_id);

        const projectId = projectIdByMilestoneId.get(submission.milestone_id);
        if (!projectId) continue;

        const current = outputMetricsByProjectId.get(projectId) ?? emptyProjectOutputMetrics();
        current.wordCount += countWords(submission.submission_text);
        outputMetricsByProjectId.set(projectId, current);
      }

      const submissionIds = Array.from(submissionProjectIds.keys());
      if (submissionIds.length > 0) {
        const { data: projectArtifacts, error: projectArtifactsError } = await supabase
          .from("milestone_submission_artifacts")
          .select("id, submission_id")
          .in("submission_id", submissionIds);
        if (projectArtifactsError) throw new Error(`Failed to fetch evidence summaries: ${projectArtifactsError.message}`);
        for (const artifact of projectArtifacts ?? []) {
          const projectId = submissionProjectIds.get(artifact.submission_id);
          if (!projectId) continue;
          const current = outputMetricsByProjectId.get(projectId) ?? emptyProjectOutputMetrics();
          current.evidenceCount += 1;
          outputMetricsByProjectId.set(projectId, current);
        }
      }

      const { data: projectReviews, error: projectReviewsError } = await supabase
        .from("milestone_reviews")
        .select("id, milestone_id, superseded_at")
        .in("milestone_id", milestoneIds)
        .is("superseded_at", null);
      if (projectReviewsError) throw new Error(`Failed to fetch reviewer feedback summaries: ${projectReviewsError.message}`);
      for (const review of projectReviews ?? []) {
        const projectId = projectIdByMilestoneId.get(review.milestone_id);
        if (!projectId) continue;
        const current = outputMetricsByProjectId.get(projectId) ?? emptyProjectOutputMetrics();
        current.reviewerFeedbackCount += 1;
        outputMetricsByProjectId.set(projectId, current);
      }
    }
  }

  return (projects ?? []).map((project) => ({
    ...project,
    hasRoadmap: roadmapProjectIds.has(project.id),
    completedMilestones: milestoneCountsByProjectId.get(project.id)?.completed ?? 0,
    totalMilestones: milestoneCountsByProjectId.get(project.id)?.total ?? 0,
    currentStepNumber:
      currentStepNumberByProjectId.get(project.id)
      ?? ((milestoneCountsByProjectId.get(project.id)?.total ?? 0) || null),
    progress: getProjectProgressSummary({
      hasRoadmap: roadmapProjectIds.has(project.id),
      completedCount: milestoneCountsByProjectId.get(project.id)?.completed ?? 0,
      totalMilestones: milestoneCountsByProjectId.get(project.id)?.total ?? 0,
      projectStatus: project.status,
    }),
    outputMetrics: outputMetricsByProjectId.get(project.id) ?? emptyProjectOutputMetrics(),
  }));
}

export async function getProjectWorkspace(projectId: string, userId: string) {
  const supabase = await createServerSupabaseClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", userId)
    .single();

  if (projectError) {
    throw new Error(`Failed to fetch project: ${projectError.message}`);
  }

  const { data: roadmap, error: roadmapError } = await supabase
    .from("project_roadmaps")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (roadmapError) {
    throw new Error(`Failed to fetch roadmap: ${roadmapError.message}`);
  }

  const { data: milestones, error: milestoneError } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("order_index", { ascending: true });

  if (milestoneError) {
    throw new Error(`Failed to fetch milestones: ${milestoneError.message}`);
  }

  return { project, roadmap, milestones: milestones ?? [] };
}
