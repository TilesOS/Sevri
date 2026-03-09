import type { ProjectTrack } from "@/lib/ai/schemas";

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

function buildSoftwareNormalizeSystemPrompt() {
  return [
    "You are Sevri's software-track profile normalizer.",
    "Return only JSON.",
    "Extract a concise software-project profile from onboarding responses.",
    "Use only these risk_flags values: too_ambitious, too_vague, too_advanced, too_little_time, misaligned_goal, insufficient_guidance, resource_constraint.",
  ].join(" ");
}

function buildResearchNormalizeSystemPrompt() {
  return [
    "You are Sevri's research-track profile normalizer.",
    "Return only JSON.",
    "Extract a concise student-research profile from onboarding responses.",
    "Keep recommendations realistic, ethical, and scoped to limited student time/resources.",
    "Use only these risk_flags values: too_ambitious, too_vague, too_advanced, too_little_time, misaligned_goal, insufficient_guidance, resource_constraint.",
  ].join(" ");
}

export function buildNormalizeSystemPrompt(projectTrack: ProjectTrack) {
  return projectTrack === "research" ? buildResearchNormalizeSystemPrompt() : buildSoftwareNormalizeSystemPrompt();
}

export function buildNormalizeUserPrompt(input: NormalizePromptInput) {
  return ["Normalize this onboarding response into structured profile data.", "Input JSON:", input.intakeJson].join("\n\n");
}

function buildSoftwareRecommendationsSystemPrompt() {
  return [
    "You are Sevri's software recommendation engine.",
    "Return only JSON.",
    "Generate exactly 3 realistic, authentic, finishable software project recommendations for a student.",
    "Prioritize finishability, technical clarity, and portfolio value.",
  ].join(" ");
}

function buildResearchRecommendationsSystemPrompt() {
  return [
    "You are Sevri's research recommendation engine.",
    "Return only JSON.",
    "Generate exactly 3 realistic, credible, finishable student research project directions.",
    "Do not overclaim rigor or novelty.",
    "Keep methodology practical, ethical, and achievable with limited resources.",
    "Each recommendation must include a clear question/hypothesis, feasible method, deliverables, and a grounded application/portfolio angle.",
  ].join(" ");
}

export function buildRecommendationsSystemPrompt(projectTrack: ProjectTrack) {
  return projectTrack === "research"
    ? buildResearchRecommendationsSystemPrompt()
    : buildSoftwareRecommendationsSystemPrompt();
}

export function buildRecommendationsUserPrompt(input: RecommendationPromptInput) {
  return ["Generate recommendations from this normalized profile.", "Normalized profile JSON:", input.normalizedProfileJson].join(
    "\n\n",
  );
}

function buildSoftwareRoadmapSystemPrompt() {
  return [
    "You are Sevri's software roadmap planner.",
    "Return only JSON.",
    "Create a concrete software execution roadmap with milestones and clear shipping guidance.",
  ].join(" ");
}

function buildResearchRoadmapSystemPrompt() {
  return [
    "You are Sevri's research roadmap planner.",
    "Return only JSON.",
    "Create a practical student research execution plan with realistic scope boundaries and credible deliverables.",
    "Do not imply publication-level rigor by default.",
    "Keep the plan ambitious but grounded in available time, mentorship, and resources.",
  ].join(" ");
}

export function buildRoadmapSystemPrompt(projectTrack: ProjectTrack) {
  return projectTrack === "research" ? buildResearchRoadmapSystemPrompt() : buildSoftwareRoadmapSystemPrompt();
}

export function buildRoadmapUserPrompt(projectTrack: ProjectTrack, input: RoadmapPromptInput) {
  return [
    `Generate a ${input.detailLevel} detail ${projectTrack} roadmap for this selected project and student profile.`,
    "Selected project JSON:",
    input.selectedProjectJson,
    "Normalized profile JSON:",
    input.normalizedProfileJson,
    input.detailLevel === "limited"
      ? "For limited detail, keep documentation concise and focus on the highest-impact plan."
      : "For full detail, include complete execution and strong application/portfolio positioning guidance.",
  ].join("\n\n");
}
