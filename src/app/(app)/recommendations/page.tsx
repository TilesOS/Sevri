import { getRequiredUser } from "@/lib/auth/guard";
import { getLatestRecommendations, getRecommendationGenerationCount } from "@/lib/db/queries/recommendations";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { RecommendationsClient } from "@/components/recommendations/recommendations-client";

export default async function RecommendationsPage() {
  const user = await getRequiredUser();

  const [recommendations, plan, batchesUsed] = await Promise.all([
    getLatestRecommendations(user.id),
    getUserPlan(user.id),
    getRecommendationGenerationCount(user.id),
  ]);

  return (
    <RecommendationsClient
      initialRecommendations={recommendations.map((item) => ({
        ...item,
        skills_demonstrated: item.skills_demonstrated ?? [],
        tools_needed: item.tools_needed ?? [],
      }))}
      plan={plan}
      batchesUsed={batchesUsed}
    />
  );
}