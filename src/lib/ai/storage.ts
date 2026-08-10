import {
  LearningResourceSchema,
  PitchKitSchema,
  ProjectOptionSchema,
  RoadmapOverviewSchema,
  type GenerationContext,
  type ProjectOption,
  type RoadmapOverview,
  type RoadmapStep,
} from "./schemas.ts";
import { formatTalkingPoint, toDeferralList } from "../projects/pitch-kit.ts";

interface StoredRecommendationRow {
  id: string;
  title: string;
  summary: string;
  rationale: string;
  difficulty: string;
  estimated_weeks: number;
  project_kind_label: string;
  repository_relevance: string;
  skills_demonstrated?: string[];
  tools_needed?: string[];
  impressiveness_score?: number;
  finishability_score?: number;
  project_blueprint_json: unknown;
  grounding_sources_json?: unknown;
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function strings(value: unknown, fallback: string[] = []) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : fallback;
}

function difficulty(value: unknown): "beginner" | "intermediate" | "advanced" {
  return value === "advanced" || value === "intermediate" || value === "beginner" ? value : "beginner";
}

export function coerceStoredProjectOption(row: StoredRecommendationRow): ProjectOption {
  const blueprint = row.project_blueprint_json && typeof row.project_blueprint_json === "object"
    ? row.project_blueprint_json as Record<string, unknown>
    : {};
  const sources = Array.isArray(row.grounding_sources_json) ? row.grounding_sources_json : [];
  return ProjectOptionSchema.parse({
    id: row.id,
    title: row.title,
    summary: row.summary,
    why_it_fits: row.rationale,
    project_kind_label: row.project_kind_label,
    repository_relevance: row.repository_relevance,
    difficulty: difficulty(row.difficulty),
    estimated_weeks: row.estimated_weeks,
    skills_demonstrated: row.skills_demonstrated?.length ? row.skills_demonstrated : ["project scoping", "evidence communication"],
    tools_needed: row.tools_needed?.length ? row.tools_needed : ["planning workspace", "documentation tools"],
    impressiveness_score: row.impressiveness_score ?? 7,
    finishability_score: row.finishability_score ?? 8,
    project_blueprint_json: {
      central_challenge: text(blueprint.central_challenge, "Complete one meaningful challenge within the available time."),
      approach: text(blueprint.approach, "Make a small first version, test it, and document what changed."),
      primary_artifacts: strings(blueprint.primary_artifacts, ["A finished core artifact"]),
      proof_of_success: strings(blueprint.proof_of_success, ["The core artifact is complete and reviewable", "The student can explain the choices behind it"]),
      scope_boundary: text(blueprint.scope_boundary, "One central challenge and the artifacts required to prove it."),
      resources_needed: strings(blueprint.resources_needed, ["Student-accessible tools and materials"]),
      safety_ethics_notes: strings(blueprint.safety_ethics_notes),
    },
    grounding_sources: sources,
  });
}

export function buildRoadmapOverviewFromStorage(input: {
  projectTitle: string;
  roadmapOverview: string;
  roadmapContextJson?: unknown;
  coreScope?: string | null;
  artifactPlan?: unknown;
  projectOverviewDraft?: string | null;
  milestones: Array<{
    order_index: number;
    title: string;
    description?: string | null;
    objective?: string | null;
    deliverable?: string | null;
    rough_time_estimate?: string | null;
  }>;
}): RoadmapOverview {
  const payload = input.roadmapContextJson && typeof input.roadmapContextJson === "object"
    ? input.roadmapContextJson as Record<string, unknown>
    : {};
  const storedSteps = Array.isArray(payload.steps) ? payload.steps as Record<string, unknown>[] : [];
  const resources = Array.isArray(payload.learning_resources)
    ? payload.learning_resources.flatMap((resource) => {
        const parsed = LearningResourceSchema.safeParse(resource);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  const artifactPlan = Array.isArray(input.artifactPlan) ? input.artifactPlan : [];

  return RoadmapOverviewSchema.parse({
    project_title: input.projectTitle,
    short_overview: input.roadmapOverview,
    project_brief: text(payload.project_brief, `${input.projectTitle} is a focused, finishable project. ${input.roadmapOverview}`),
    core_scope: input.coreScope || text(payload.core_scope, "Complete the primary artifact and collect observable evidence that it works."),
    artifact_plan: artifactPlan.length ? artifactPlan : [{ artifact: "Core project artifact", purpose: "Make the central challenge visible and reviewable." }],
    project_overview_draft: input.projectOverviewDraft || text(payload.project_overview_draft, `${input.projectTitle} turns a specific interest into a finished artifact with a clear proof of success.`),
    steps: input.milestones.map((milestone) => {
      const stored = storedSteps.find((step) => step.order_index === milestone.order_index);
      return {
        order_index: milestone.order_index,
        title: milestone.title,
        objective: text(milestone.objective, text(milestone.description, "Complete the work for this step.")),
        deliverable: text(milestone.deliverable, "A concrete output for this step"),
        rough_time_estimate: text(milestone.rough_time_estimate, "About 1 week"),
        validation_check: text(stored?.validation_check, `The deliverable for ${milestone.title} is complete and reviewable.`),
        scope_guardrail: text(stored?.scope_guardrail, "Stay focused on this step's deliverable."),
      };
    }),
    cut_if_behind: strings(payload.cut_if_behind, ["Optional polish beyond the core proof loop"]),
    success_criteria: strings(payload.success_criteria, ["The core artifact is complete and reviewable", "The student can explain the work and its limitations"]),
    pitch_kit: PitchKitSchema.safeParse(payload.pitch_kit).data ?? null,
    learning_resources: resources.length >= 3 ? resources : null,
  });
}

export function buildRoadmapStorageArtifacts(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  roadmap: RoadmapOverview;
}) {
  const pitchKit = input.roadmap.pitch_kit;
  return {
    coreScope: input.roadmap.core_scope,
    artifactPlan: input.roadmap.artifact_plan,
    projectOverviewDraft: input.roadmap.project_overview_draft,
    stretchGoals: toDeferralList(input.roadmap.cut_if_behind),
    explanationGuide: {
      elevator_pitch: pitchKit?.elevator_pitch ?? input.roadmap.project_overview_draft,
      resume_bullets: pitchKit?.resume_bullets ?? [],
      interview_talking_points: pitchKit?.talking_points.map((point) => formatTalkingPoint(point)) ?? [],
      source: pitchKit ? "model" : "draft",
    },
    roadmapContextJson: {
      project_brief: input.roadmap.project_brief,
      core_scope: input.roadmap.core_scope,
      artifact_plan: input.roadmap.artifact_plan,
      project_overview_draft: input.roadmap.project_overview_draft,
      steps: input.roadmap.steps.map((step) => ({
        order_index: step.order_index,
        validation_check: step.validation_check,
        scope_guardrail: step.scope_guardrail,
      })),
      cut_if_behind: input.roadmap.cut_if_behind,
      success_criteria: input.roadmap.success_criteria,
      selected_project_blueprint: input.selectedOption.project_blueprint_json,
      pitch_kit: input.roadmap.pitch_kit ?? null,
      learning_resources: input.roadmap.learning_resources ?? [],
      focus_summary: input.context.summary,
      step_count: input.roadmap.steps.length,
    },
  };
}

export function buildMilestoneInsert(step: RoadmapStep) {
  return {
    order_index: step.order_index ?? 0,
    title: step.title,
    description: `${step.objective} Deliverable: ${step.deliverable}. Time: ${step.rough_time_estimate}.`,
    objective: step.objective,
    deliverable: step.deliverable,
    rough_time_estimate: step.rough_time_estimate,
  };
}
