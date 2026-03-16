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

export function coerceStoredProjectOption(row: StoredRecommendationRow): ProjectOption {
  if (row.project_track === "research") {
    return ResearchProjectOptionSchema.parse({
      id: row.id,
      project_track: "research",
      title: row.title,
      summary: row.summary,
      why_it_fits: row.rationale,
      difficulty: row.difficulty,
      estimated_weeks: row.estimated_weeks,
      track_payload_json: row.track_payload_json,
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
    track_payload_json: row.track_payload_json,
  });
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

export function buildRoadmapOverviewFromStorage(input: {
  projectTitle: string;
  roadmapOverview: string;
  milestones: Array<{
    order_index: number;
    title: string;
    description?: string | null;
    objective?: string | null;
    deliverable?: string | null;
    rough_time_estimate?: string | null;
  }>;
}): RoadmapOverview {
  return RoadmapOverviewSchema.parse({
    project_title: input.projectTitle,
    short_overview: input.roadmapOverview,
    steps: input.milestones.map((milestone) => ({
      order_index: milestone.order_index,
      title: milestone.title,
      objective: asString(milestone.objective, asString(milestone.description, "Complete the work for this step.")),
      deliverable: asString(milestone.deliverable, "A concrete output for this step"),
      rough_time_estimate: asString(milestone.rough_time_estimate, "About 1 week"),
    })),
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
      focus_summary: input.context.summary,
      selected_option_seed: input.selectedOption.track_payload_json,
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
