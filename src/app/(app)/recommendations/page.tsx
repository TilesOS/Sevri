import type { Metadata } from "next";
import { getRequiredUser } from "@/lib/auth/guard";
import { getLatestRecommendations, getRecommendationGenerationCount, getRecommendationAvailability } from "@/lib/db/queries/recommendations";
import { getUserPlan } from "@/lib/db/queries/subscriptions";
import { RecommendationsClient } from "@/components/recommendations/recommendations-client";

export const metadata: Metadata = {
  title: "Project ideas",
};

export default async function RecommendationsPage() {
  const user = await getRequiredUser();
  const [recommendations, plan, generationsUsed, availability] = await Promise.all([
    getLatestRecommendations(user.id),
    getUserPlan(user.id),
    getRecommendationGenerationCount(user.id),
    getRecommendationAvailability(user.id),
  ]);

  return (
    <RecommendationsClient
      initialRecommendations={recommendations.map((item) => ({
        ...item,
        normalized_profile_id: item.normalized_profile_id,
        project_kind_label: item.project_kind_label,
        repository_relevance: item.repository_relevance,
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
      availability={availability}
    />
  );
}
