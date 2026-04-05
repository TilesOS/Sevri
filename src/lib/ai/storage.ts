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
  skills_demonstrated?: string[];
  tools_needed?: string[];
  impressiveness_score?: number;
  finishability_score?: number;
  track_payload_json: unknown;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function coerceDifficulty(value: unknown) {
  if (value === "advanced" || value === "intermediate" || value === "beginner") {
    return value;
  }

  if (value === "intermediate_advanced") {
    return "advanced";
  }

  if (value === "beginner_intermediate") {
    return "beginner";
  }

  return "beginner";
}

function normalizeSentence(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampSentence(value: string, maxLength = 150) {
  const normalized = normalizeSentence(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  const safe = lastSpace > 80 ? truncated.slice(0, lastSpace) : truncated;
  return `${safe.trimEnd()}...`;
}

function firstSentence(value: string, fallback: string, maxLength = 150) {
  const normalized = normalizeSentence(value);
  if (!normalized) {
    return fallback;
  }

  const match = normalized.match(/^(.*?[.!?])(?:\s|$)/);
  const sentence = match ? match[1] : normalized.split(";")[0] ?? normalized;
  return clampSentence(sentence, maxLength);
}

function trimTrailingPeriod(value: string) {
  return value.replace(/[.?!]+$/, "").trim();
}

function buildInterviewTalkingPoints(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  roadmap: RoadmapOverview;
}) {
  if (input.selectedOption.project_track === "research") {
    const seed = input.selectedOption.track_payload_json;
    const evidencePlan = trimTrailingPeriod(seed.evidence_plan);
    const methodology = trimTrailingPeriod(seed.methodology);
    const researchQuestion = trimTrailingPeriod(seed.research_question);

    return [
      `Why this project: ${firstSentence(
        input.selectedOption.why_it_fits,
        "It aligns with the student's domain interests and gives them a believable question to own.",
      )}`,
      `What it does: It investigates ${researchQuestion.toLowerCase()} using ${methodology.toLowerCase()} and a bounded evidence plan.`,
      `Broader implications: It turns a broad question into evidence people can actually discuss, using ${evidencePlan.toLowerCase()} instead of vague assumptions.`,
    ];
  }

  const seed = input.selectedOption.track_payload_json;
  const targetUser = trimTrailingPeriod(seed.target_user);
  const coreWorkflow = trimTrailingPeriod(seed.core_workflow);
  const problemStatement = trimTrailingPeriod(seed.problem_statement);

  return [
    `Why this project: ${firstSentence(
      input.selectedOption.why_it_fits,
      "It matches the student's background, constraints, and the kind of proof they want to show.",
    )}`,
    `What it does: It gives ${targetUser.toLowerCase()} a focused way to ${coreWorkflow.toLowerCase()}.`,
    `Broader implications: It matters because ${problemStatement.toLowerCase()} is a real workflow problem, and this project makes that problem easier to handle in practice.`,
  ];
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
      difficulty: coerceDifficulty(row.difficulty),
      estimated_weeks: row.estimated_weeks,
      skills_demonstrated: row.skills_demonstrated?.length ? row.skills_demonstrated : ["research design", "evidence synthesis"],
      tools_needed: row.tools_needed?.length ? row.tools_needed : ["spreadsheet", "notes doc"],
      impressiveness_score: typeof row.impressiveness_score === "number" ? row.impressiveness_score : 7,
      finishability_score: typeof row.finishability_score === "number" ? row.finishability_score : 8,
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
    difficulty: coerceDifficulty(row.difficulty),
    estimated_weeks: row.estimated_weeks,
    skills_demonstrated: row.skills_demonstrated?.length ? row.skills_demonstrated : ["product scoping", "workflow design"],
    tools_needed: row.tools_needed?.length ? row.tools_needed : ["TypeScript", "React"],
    impressiveness_score: typeof row.impressiveness_score === "number" ? row.impressiveness_score : 7,
    finishability_score: typeof row.finishability_score === "number" ? row.finishability_score : 8,
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
    repoStructure:
      input.selectedOption.project_track === "research"
        ? [
            { path: "notes/question-brief.md", purpose: "Lock the question, scope boundaries, and success criteria." },
            { path: "analysis/workspace.md", purpose: "Track the evidence plan, analysis steps, and findings." },
            { path: "deliverables/final-brief.md", purpose: "Package the final narrative, visuals, and limitations." },
          ]
        : [
            { path: "src/app/page.tsx", purpose: "Primary demo surface for the core workflow." },
            { path: "src/lib/core.ts", purpose: "Core workflow logic and validation rules." },
            { path: "docs/demo-script.md", purpose: "Narrative for demoing the product and its proof of value." },
          ],
    readmeDraft: `# ${input.roadmap.project_title}\n\n## Overview\n${input.roadmap.short_overview}\n\n## Roadmap\n${stepLines}\n`,
    stretchGoals: input.roadmap.cut_if_behind.map((item) => `Stretch later: ${item}`),
    explanationGuide: {
      elevator_pitch: `${input.roadmap.project_title} is a focused ${input.context.project_track} project built around ${input.selectedOption.summary.toLowerCase()}`,
      resume_bullets: [
        `Built ${input.roadmap.project_title} to address ${input.selectedOption.summary.toLowerCase()}.`,
        `Scoped the MVP around ${input.roadmap.steps[0]?.deliverable.toLowerCase() ?? "one concrete deliverable"} and validated progress against explicit milestones.`,
      ],
      interview_talking_points: buildInterviewTalkingPoints(input),
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
