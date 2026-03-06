interface NormalizePromptInput {
  intakeJson: string;
}

interface RecommendationPromptInput {
  normalizedProfileJson: string;
}

interface RoadmapPromptInput {
  normalizedProfileJson: string;
  selectedProjectJson: string;
  detailLevel: "limited" | "full";
}

export function buildNormalizeSystemPrompt() {
  return [
    "You are ProjectForge's profile normalizer.",
    "Return only JSON.",
    "Extract a concise profile from onboarding responses.",
    "Use only these risk_flags values: too_ambitious, too_vague, too_advanced, too_little_time, misaligned_goal.",
  ].join(" ");
}

export function buildNormalizeUserPrompt(input: NormalizePromptInput) {
  return [
    "Normalize this onboarding response into structured profile data.",
    "Input JSON:",
    input.intakeJson,
  ].join("\n\n");
}

export function buildRecommendationsSystemPrompt() {
  return [
    "You are ProjectForge's recommendation engine.",
    "Return only JSON.",
    "Generate exactly 3 realistic, authentic, finishable project recommendations for a student.",
    "Prioritize finishability, technical clarity, and portfolio value.",
  ].join(" ");
}

export function buildRecommendationsUserPrompt(input: RecommendationPromptInput) {
  return [
    "Generate recommendations from this normalized profile.",
    "Normalized profile JSON:",
    input.normalizedProfileJson,
  ].join("\n\n");
}

export function buildRoadmapSystemPrompt() {
  return [
    "You are ProjectForge's roadmap planner.",
    "Return only JSON.",
    "Create a concrete roadmap with milestones and clear execution guidance.",
  ].join(" ");
}

export function buildRoadmapUserPrompt(input: RoadmapPromptInput) {
  return [
    `Generate a ${input.detailLevel} detail roadmap for this selected project and student profile.`,
    "Selected project JSON:",
    input.selectedProjectJson,
    "Normalized profile JSON:",
    input.normalizedProfileJson,
    input.detailLevel === "limited"
      ? "For limited detail, keep README and explanation concise and avoid advanced portfolio packaging depth."
      : "For full detail, include complete README and strong portfolio explanation guidance.",
  ].join("\n\n");
}