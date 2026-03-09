import { getRequiredUser } from "@/lib/auth/guard";
import {
  getLatestProjectTrack,
  getLatestRecommendations,
  getRecommendationGenerationCount,
} from "@/lib/db/queries/recommendations";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { RecommendationsClient } from "@/components/recommendations/recommendations-client";
import type { ProjectTrack } from "@/types/domain";

function asProjectTrack(value: unknown): ProjectTrack {
  return value === "research" ? "research" : "software";
}

export default async function RecommendationsPage() {
  const user = await getRequiredUser();

  const activeTrack = await getLatestProjectTrack(user.id);

  const [recommendations, plan, batchesUsed] = await Promise.all([
    getLatestRecommendations(user.id, activeTrack),
    getUserPlan(user.id),
    getRecommendationGenerationCount(user.id),
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
    />
  );
}
