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

  const [recommendations, plan, batchesUsed, trackAvailability] = await Promise.all([
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
        project_track: asProjectTrack(item.project_track),
        skills_demonstrated: item.skills_demonstrated ?? [],
        tools_needed: item.tools_needed ?? [],
      }))}
      plan={plan}
      batchesUsed={batchesUsed}
      trackAvailability={trackAvailability}
    />
  );
}
