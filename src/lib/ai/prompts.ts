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

const bannedDefaultThemes = [
  "student-life",
  "study habits",
  "wellness",
  "generic productivity",
  "application-ready storytelling without a real project",
].join(", ");

function buildSoftwareNormalizeSystemPrompt() {
  return [
    "You are Sevri's software-track profile normalizer.",
    "Return only JSON.",
    "Extract a concrete software-project planning brief from the onboarding answers.",
    "Anchor the profile to the user's actual technical interests, tools, constraints, and desired outcomes.",
    "Infer at most one step beyond what the user explicitly signals.",
    `Do not drift into ${bannedDefaultThemes} unless the user explicitly points there.`,
    "Use only these risk_flags values: too_ambitious, too_vague, too_advanced, too_little_time, misaligned_goal, insufficient_guidance, resource_constraint.",
    "In track_payload_json include domain_brief, anchor_interests, goal_signal, resource_snapshot, anti_generic_warnings, project_style_fit, scope_guardrails, problem_lenses, and delivery_bias.",
  ].join(" ");
}

function buildResearchNormalizeSystemPrompt() {
  return [
    "You are Sevri's research-track profile normalizer.",
    "Return only JSON.",
    "Extract a concrete student research planning brief from the onboarding answers.",
    "Anchor the profile to the user's actual domain, method preference, available resources, and realistic level of support.",
    "Infer at most one step beyond what the user explicitly signals.",
    `Do not drift into ${bannedDefaultThemes} unless the user explicitly points there.`,
    "Keep the research direction ambitious but believable for a motivated student.",
    "Use only these risk_flags values: too_ambitious, too_vague, too_advanced, too_little_time, misaligned_goal, insufficient_guidance, resource_constraint.",
    "In track_payload_json include domain_brief, anchor_interests, goal_signal, resource_snapshot, anti_generic_warnings, research_readiness, scope_guardrails, mentor_resource_notes, and viable_methodologies.",
  ].join(" ");
}

export function buildNormalizeSystemPrompt(projectTrack: ProjectTrack) {
  return projectTrack === "research" ? buildResearchNormalizeSystemPrompt() : buildSoftwareNormalizeSystemPrompt();
}

export function buildNormalizeUserPrompt(input: NormalizePromptInput) {
  return [
    "Normalize this onboarding response into structured profile data.",
    "Prioritize the user's real domain language over polished generic framing.",
    "If the user names something technical like chip architecture, photonics, systems, or robotics, keep the profile centered there.",
    "Input JSON:",
    input.intakeJson,
  ].join("\n\n");
}

function buildSoftwareRecommendationsSystemPrompt() {
  return [
    "You are Sevri's software recommendation engine.",
    "Return only JSON.",
    "Generate exactly 3 realistic, domain-grounded, portfolio-worthy software project recommendations.",
    "Each recommendation must define a real user, a concrete problem, a believable MVP, and a useful validation path.",
    "Make the project itself the center of gravity, not motivational framing.",
    "Avoid generic study assistants, vague productivity apps, or student-life tools unless the normalized profile clearly supports them.",
    "Prefer tools, simulators, workflow systems, analysis products, debugging utilities, or niche applications tied to the user's actual interests.",
    "In track_payload_json include target_user, problem_statement, core_workflow, mvp_boundary, and validation_plan.",
  ].join(" ");
}

function buildResearchRecommendationsSystemPrompt() {
  return [
    "You are Sevri's research recommendation engine.",
    "Return only JSON.",
    "Generate exactly 3 realistic, technically credible, finishable student research directions.",
    "Each recommendation must define a real research question, a clear investigation focus, a feasible methodology, an evidence or data plan, realistic scope boundaries, and a limitation note.",
    "Make the question and method concrete enough that the project feels real.",
    "Do not default to student-life, study habits, or wellness topics unless the normalized profile explicitly points there.",
    "Do not pretend the student is doing PhD-level lab research by default; stay ambitious but believable.",
    "In track_payload_json include research_question, hypothesis_or_focus, methodology, evidence_or_data_plan, scope_boundaries, and limitation_note.",
  ].join(" ");
}

export function buildRecommendationsSystemPrompt(projectTrack: ProjectTrack) {
  return projectTrack === "research"
    ? buildResearchRecommendationsSystemPrompt()
    : buildSoftwareRecommendationsSystemPrompt();
}

export function buildRecommendationsUserPrompt(input: RecommendationPromptInput) {
  return [
    "Generate recommendations from this normalized profile.",
    "Reuse the anchor_interests and domain_brief directly. Each recommendation should feel obviously related to them.",
    "Normalized profile JSON:",
    input.normalizedProfileJson,
  ].join("\n\n");
}

function buildSoftwareRoadmapSystemPrompt() {
  return [
    "You are Sevri's software roadmap planner.",
    "Return only JSON.",
    "Create a concrete execution roadmap for one software project.",
    "Milestones must be sequential, project-specific, and actionable.",
    "Every milestone description should name the deliverable or implementation artifact that will exist at the end of that step.",
    "Do not use generic milestone labels like Foundation Setup, Core Workflow, Build the Project, or Polish.",
    "Generate 4 to 6 milestones.",
    "In track_payload_json include target_user, problem_statement, core_workflow, mvp_boundary, validation_checkpoint, and ship_criteria.",
  ].join(" ");
}

function buildResearchRoadmapSystemPrompt() {
  return [
    "You are Sevri's research roadmap planner.",
    "Return only JSON.",
    "Create a practical, ambitious, student-scale research execution plan.",
    "Milestones must be sequential, project-specific, and actionable.",
    "Every milestone description should name the deliverable or evidence artifact that will exist at the end of that step.",
    "Do not use generic milestone labels like Question + Scope Lock, Method Design, or Refine and Present unless the title also names the actual project work.",
    "Generate 4 to 6 milestones.",
    "Keep the plan grounded in the student's available time, mentorship, and resources.",
    "In track_payload_json include research_question, hypothesis_or_focus, methodology, evidence_or_data_plan, scope_boundaries, limitation_note, why_this_fits, step_by_step_plan, timeline_and_milestones, risks_and_blockers, final_deliverables, and portfolio_or_application_positioning.",
  ].join(" ");
}

export function buildRoadmapSystemPrompt(projectTrack: ProjectTrack) {
  return projectTrack === "research" ? buildResearchRoadmapSystemPrompt() : buildSoftwareRoadmapSystemPrompt();
}

export function buildRoadmapUserPrompt(projectTrack: ProjectTrack, input: RoadmapPromptInput) {
  return [
    `Generate a ${input.detailLevel} detail ${projectTrack} roadmap for this selected project and normalized profile.`,
    "The roadmap should read like an actual execution plan a strong student could follow week by week.",
    projectTrack === "research"
      ? "Research milestones should mention items like literature matrix, protocol draft, dataset or instrument, analysis notebook, figures/tables, abstract, poster, or paper sections when relevant."
      : "Software milestones should mention items like schema, endpoints, benchmark harness, simulator module, UI flow, deployment, tests, README sections, or validation artifacts when relevant.",
    "Selected project JSON:",
    input.selectedProjectJson,
    "Normalized profile JSON:",
    input.normalizedProfileJson,
    input.detailLevel === "limited"
      ? "For limited detail, keep the surrounding guidance concise but keep milestone descriptions specific."
      : "For full detail, include stronger positioning guidance, validation checkpoints, and concrete deliverables without becoming fluffy.",
  ].join("\n\n");
}
