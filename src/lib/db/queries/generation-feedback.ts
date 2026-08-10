import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PromptFeedbackItem } from "@/lib/ai/prompts";
import type { Database } from "@/types/db";

type FeedbackRow = Database["public"]["Tables"]["generation_feedback"]["Row"];

function toPromptFeedback(row: FeedbackRow, recommendationTitles: Map<string, string>): PromptFeedbackItem {
  const contextLabel =
    row.closest_recommendation_id && recommendationTitles.has(row.closest_recommendation_id)
      ? `Closest option: ${recommendationTitles.get(row.closest_recommendation_id)}`
      : null;

  return {
    signal: row.signal,
    notes: row.notes,
    contextLabel,
  };
}

async function getRecommendationTitles(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, string>();
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("project_recommendations")
    .select("id, title")
    .in("id", ids);

  if (error) {
    throw new Error(`Failed to load recommendation labels: ${error.message}`);
  }

  return new Map((data ?? []).map((item) => [item.id, item.title]));
}

async function mapFeedbackRows(rows: FeedbackRow[]) {
  const titles = await getRecommendationTitles(
    Array.from(new Set(rows.map((row) => row.closest_recommendation_id).filter((value): value is string => Boolean(value)))),
  );

  return rows.map((row) => toPromptFeedback(row, titles));
}

export async function getRecommendationFeedback(userId: string, limit = 4) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("generation_feedback")
    .select("*")
    .eq("user_id", userId)
    .eq("stage", "recommendations")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load recommendation feedback: ${error.message}`);
  }

  return mapFeedbackRows((data ?? []) as FeedbackRow[]);
}

export async function getRoadmapFeedback(input: {
  userId: string;
  projectId: string;
  normalizedProfileId: string;
  selectedRecommendationId: string;
}) {
  const supabase = await createServerSupabaseClient();
  const [recommendationFeedback, roadmapFeedback] = await Promise.all([
    supabase
      .from("generation_feedback")
      .select("*")
      .eq("user_id", input.userId)
      .eq("stage", "recommendations")
      .or(`normalized_profile_id.eq.${input.normalizedProfileId},closest_recommendation_id.eq.${input.selectedRecommendationId}`)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("generation_feedback")
      .select("*")
      .eq("user_id", input.userId)
      .eq("stage", "roadmap")
      .eq("project_id", input.projectId)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  if (recommendationFeedback.error) {
    throw new Error(`Failed to load recommendation feedback: ${recommendationFeedback.error.message}`);
  }

  if (roadmapFeedback.error) {
    throw new Error(`Failed to load roadmap feedback: ${roadmapFeedback.error.message}`);
  }

  const rows = [...((roadmapFeedback.data ?? []) as FeedbackRow[]), ...((recommendationFeedback.data ?? []) as FeedbackRow[])];
  rows.sort((left, right) => right.created_at.localeCompare(left.created_at));
  return mapFeedbackRows(rows);
}

export async function getStepGuidanceFeedback(input: {
  userId: string;
  projectId: string;
  milestoneId: string;
}) {
  const supabase = await createServerSupabaseClient();
  const [roadmapFeedback, guidanceFeedback] = await Promise.all([
    supabase
      .from("generation_feedback")
      .select("*")
      .eq("user_id", input.userId)
      .eq("stage", "roadmap")
      .eq("project_id", input.projectId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("generation_feedback")
      .select("*")
      .eq("user_id", input.userId)
      .eq("stage", "step_guidance")
      .eq("milestone_id", input.milestoneId)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  if (roadmapFeedback.error) {
    throw new Error(`Failed to load roadmap feedback: ${roadmapFeedback.error.message}`);
  }

  if (guidanceFeedback.error) {
    throw new Error(`Failed to load guidance feedback: ${guidanceFeedback.error.message}`);
  }

  const rows = [...((guidanceFeedback.data ?? []) as FeedbackRow[]), ...((roadmapFeedback.data ?? []) as FeedbackRow[])];
  rows.sort((left, right) => right.created_at.localeCompare(left.created_at));
  return mapFeedbackRows(rows);
}
