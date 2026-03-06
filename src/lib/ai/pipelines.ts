import {
  buildNormalizeSystemPrompt,
  buildNormalizeUserPrompt,
  buildRecommendationsSystemPrompt,
  buildRecommendationsUserPrompt,
  buildRoadmapSystemPrompt,
  buildRoadmapUserPrompt,
} from "@/lib/ai/prompts";
import { generateStructuredOutput } from "@/lib/ai/client";
import {
  NormalizedProfileSchema,
  RecommendationBatchSchema,
  RoadmapSchema,
  type NormalizedProfile,
} from "@/lib/ai/schemas";

export async function runProfileNormalization(rawIntake: Record<string, unknown>) {
  return generateStructuredOutput({
    schema: NormalizedProfileSchema,
    systemPrompt: buildNormalizeSystemPrompt(),
    userPrompt: buildNormalizeUserPrompt({ intakeJson: JSON.stringify(rawIntake) }),
    maxRetries: 2,
  });
}

export async function runRecommendationGeneration(normalizedProfile: NormalizedProfile) {
  const result = await generateStructuredOutput({
    schema: RecommendationBatchSchema,
    systemPrompt: buildRecommendationsSystemPrompt(),
    userPrompt: buildRecommendationsUserPrompt({ normalizedProfileJson: JSON.stringify(normalizedProfile) }),
    maxRetries: 2,
  });

  const withSafeIds = result.parsed.recommendations.map((item, index) => ({
    ...item,
    id: item.id || `project_${index + 1}`,
  }));

  return {
    parsed: {
      recommendations: withSafeIds,
    },
    raw: result.raw,
  };
}

export async function runRoadmapGeneration(input: {
  selectedProject: Record<string, unknown>;
  normalizedProfile: NormalizedProfile;
  detailLevel: "limited" | "full";
}) {
  return generateStructuredOutput({
    schema: RoadmapSchema,
    systemPrompt: buildRoadmapSystemPrompt(),
    userPrompt: buildRoadmapUserPrompt({
      selectedProjectJson: JSON.stringify(input.selectedProject),
      normalizedProfileJson: JSON.stringify(input.normalizedProfile),
      detailLevel: input.detailLevel,
    }),
    maxRetries: 2,
  });
}