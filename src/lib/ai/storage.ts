import {
  ResearchProjectOptionSchema,
  RoadmapOverviewSchema,
  SoftwareProjectOptionSchema,
  type GenerationContext,
  type ProjectOption,
  type RoadmapOverview,
  type RoadmapStep,
} from "@/lib/ai/schemas";

interface StoredRecommendationRow {
  id: string;
  project_track: string;
  title: string;
  summary: string;
  rationale: string;
  difficulty: string;
  estimated_weeks: number;
  track_payload_json: unknown;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function coerceStoredProjectOption(row: StoredRecommendationRow): ProjectOption {
  const rawPayload = (row.track_payload_json && typeof row.track_payload_json === "object"
    ? row.track_payload_json
    : {}) as Record<string, unknown>;

  if (row.project_track === "research") {
    return ResearchProjectOptionSchema.parse({
      id: row.id,
      project_track: "research",
      title: row.title,
      summary: row.summary,
      why_it_fits: row.rationale,
      difficulty: row.difficulty,
      estimated_weeks: row.estimated_weeks,
      track_payload_json: {
        research_question: asString(rawPayload.research_question, "What is the key factor?"),
        hypothesis_or_focus: asString(rawPayload.hypothesis_or_focus, "One factor has an outsized effect on the outcome."),
        methodology: asString(rawPayload.methodology, "secondary data analysis"),
        evidence_plan: asString(rawPayload.evidence_plan, "Use one accessible dataset."),
        scope_boundaries: asString(rawPayload.scope_boundaries, "Limit to one factor and one dataset."),
        limitation_note: asString(rawPayload.limitation_note, "Findings are correlational within the chosen dataset."),
      },
    });
  }

  return SoftwareProjectOptionSchema.parse({
    id: row.id,
    project_track: "software",
    title: row.title,
    summary: row.summary,
    why_it_fits: row.rationale,
    difficulty: row.difficulty,
    estimated_weeks: row.estimated_weeks,
    track_payload_json: {
      target_user: asString(rawPayload.target_user, "users of this tool"),
      problem_statement: asString(rawPayload.problem_statement, "Users need a better workflow."),
      core_workflow: asString(rawPayload.core_workflow, "Complete the core task end to end."),
      mvp_boundary: asString(rawPayload.mvp_boundary, "One workflow, one input type, one output format."),
      validation_plan: asString(rawPayload.validation_plan, "Test the workflow on realistic inputs."),
    },
  });
}

export function buildRoadmapOverviewFromStorage(input: {
  projectTitle: string;
  roadmapOverview: string;
  trackPayloadJson?: unknown;
  milestones: Array<{
    order_index: number;
    title: string;
    description?: string | null;
    objective?: string | null;
    deliverable?: string | null;
    rough_time_estimate?: string | null;
  }>;
}): RoadmapOverview {
  const payload = (input.trackPayloadJson && typeof input.trackPayloadJson === "object"
    ? input.trackPayloadJson
    : {}) as Record<string, unknown>;

  const storedProjectBrief = asString(
    payload.project_brief,
    `${input.projectTitle} is a focused project. ${input.roadmapOverview}`,
  );
  const storedCutIfBehind = Array.isArray(payload.cut_if_behind)
    ? (payload.cut_if_behind as unknown[]).filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  const storedSuccessCriteria = Array.isArray(payload.success_criteria)
    ? (payload.success_criteria as unknown[]).filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];
  const storedSteps = Array.isArray(payload.steps) ? (payload.steps as Record<string, unknown>[]) : [];

  const steps = input.milestones.map((milestone) => {
    const storedStep = storedSteps.find(
      (s) => typeof s.order_index === "number" && s.order_index === milestone.order_index,
    );

    return {
      order_index: milestone.order_index,
      title: milestone.title,
      objective: asString(milestone.objective, asString(milestone.description, "Complete the work for this step.")),
      deliverable: asString(milestone.deliverable, "A concrete output for this step"),
      rough_time_estimate: asString(milestone.rough_time_estimate, "About 1 week"),
      validation_check: asString(
        storedStep?.validation_check,
        `The deliverable for "${milestone.title}" is complete and reviewable.`,
      ),
      scope_guardrail: asString(
        storedStep?.scope_guardrail,
        "Stay focused on this step's deliverable — do not expand scope.",
      ),
    };
  });

  return RoadmapOverviewSchema.parse({
    project_title: input.projectTitle,
    short_overview: input.roadmapOverview,
    project_brief: storedProjectBrief,
    steps,
    cut_if_behind: storedCutIfBehind.length > 0 ? storedCutIfBehind : ["Defer stretch features until the core is solid"],
    success_criteria: storedSuccessCriteria.length > 0 ? storedSuccessCriteria : [
      "The core deliverable is complete and reviewable",
      "The student can explain the work and decisions behind it",
    ],
  });
}

export function buildRoadmapStorageArtifacts(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  roadmap: RoadmapOverview;
}) {
  const stepLines = input.roadmap.steps
    .map((step) => `- ${step.title}: ${step.deliverable} (${step.rough_time_estimate})`)
    .join("\n");

  return {
    mvpScope:
      input.selectedOption.project_track === "research"
        ? `Keep the work centered on ${input.selectedOption.track_payload_json.research_question.toLowerCase()} and do not expand beyond the current evidence plan.`
        : `Keep the MVP centered on ${input.selectedOption.track_payload_json.core_workflow.toLowerCase()} and avoid optional feature creep.`,
    repoStructure: [] as Array<{ path: string; purpose: string }>,
    readmeDraft: `# ${input.roadmap.project_title}\n\n## Overview\n${input.roadmap.short_overview}\n\n## Roadmap\n${stepLines}\n`,
    stretchGoals: [] as string[],
    explanationGuide: {
      elevator_pitch: `${input.roadmap.project_title} is a focused ${input.context.project_track} project built around ${input.selectedOption.summary.toLowerCase()}`,
      resume_bullets: [] as string[],
      interview_talking_points: [] as string[],
    },
    trackPayloadJson: {
      project_brief: input.roadmap.project_brief,
      steps: input.roadmap.steps.map((step) => ({
        order_index: step.order_index,
        validation_check: step.validation_check,
        scope_guardrail: step.scope_guardrail,
      })),
      cut_if_behind: input.roadmap.cut_if_behind,
      success_criteria: input.roadmap.success_criteria,
      selected_option_seed: input.selectedOption.track_payload_json,
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
