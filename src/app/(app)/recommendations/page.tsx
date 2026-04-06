import { getRequiredUser } from "@/lib/auth/guard";
import {
  getLatestProjectTrack,
  getLatestRecommendations,
  getRecommendationGenerationCount,
  getTrackAvailability,
} from "@/lib/db/queries/recommendations";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { RecommendationsClient } from "@/components/recommendations/recommendations-client";
import type { ProjectTrack } from "@/types/domain";

function asProjectTrack(value: unknown): ProjectTrack {
  return value === "research" ? "research" : "software";
}

function getRequestedTrack(value: string | undefined, fallback: ProjectTrack): ProjectTrack {
  return value === "research" || value === "software" ? value : fallback;
}

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const user = await getRequiredUser();
  const resolvedSearchParams = await searchParams;

  const defaultTrack = await getLatestProjectTrack(user.id);
  const activeTrack = getRequestedTrack(resolvedSearchParams.track, defaultTrack);

  const [recommendations, plan, generationsUsed, trackAvailability] = await Promise.all([
    getLatestRecommendations(user.id, activeTrack),
    getUserPlan(user.id),
    getRecommendationGenerationCount(user.id),
    getTrackAvailability(user.id),
  ]);

  return (
    <RecommendationsClient
      activeTrack={activeTrack}
      initialRecommendations={recommendations.map((item) => ({
        ...item,
        normalized_profile_id: item.normalized_profile_id,
        project_track: asProjectTrack(item.project_track),
        why_it_fits: item.rationale,
        weekly_hours: item.weekly_hours,
        skills_demonstrated: item.skills_demonstrated,
        tools_needed: item.tools_needed,
        impressiveness_score: item.impressiveness_score,
        finishability_score: item.finishability_score,
        authenticity_note: item.authenticity_note,
      }))}
      plan={plan}
      generationsUsed={generationsUsed}
      trackAvailability={trackAvailability}
    />
  );
}
