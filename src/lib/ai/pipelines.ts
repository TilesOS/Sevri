import {
  buildOptionsSystemPrompt,
  buildOptionsUserPrompt,
  buildRoadmapSystemPrompt,
  buildRoadmapUserPrompt,
  buildStepGuidanceSystemPrompt,
  buildStepGuidanceUserPrompt,
} from "@/lib/ai/prompts";
import { generateStructuredOutput, getGenerationVersion, type GenerationMetrics } from "@/lib/ai/client";
import {
  estimateWeeksFromContext,
  estimateWeeklyHoursFromContext,
  getDomainFamilyFromContext,
  getPrimaryAnchor,
  hasGrounding,
  slugify,
} from "@/lib/ai/generation-context";
import {
  RecommendationBatchSchema,
  RoadmapOverviewSchema,
  StepGuidanceSchema,
  type GenerationContext,
  type ProjectOption,
  type RecommendationBatch,
  type RoadmapOverview,
  type RoadmapStep,
  type StepGuidance,
} from "@/lib/ai/schemas";

const STUDENT_THEME_PATTERNS = [
  /student[-\s]?life/i,
  /study habit/i,
  /well[-\s]?being/i,
  /wellness/i,
  /productivity app/i,
  /study assistant/i,
  /campus/i,
  /academic success/i,
];

const GENERIC_STEP_TITLES = new Set([
  "foundation setup",
  "core workflow",
  "insight layer",
  "polish and packaging",
  "research your topic",
  "build the project",
  "refine and present",
]);

interface PipelineResult<T> {
  parsed: T;
  raw: unknown;
  metrics: GenerationMetrics;
}

function buildFallbackMetrics(stage: GenerationMetrics["stage"], model = "deterministic-fallback"): GenerationMetrics {
  return {
    stage,
    generation_version: getGenerationVersion(),
    model,
    attempt_count: 1,
    ai_total_ms: 0,
    validation_ms: 0,
    prompt_chars: 0,
    output_chars: 0,
    fallback_used: true,
  };
}

function getFailureMetrics(error: unknown, stage: GenerationMetrics["stage"]): GenerationMetrics {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { metrics?: GenerationMetrics };
      if (parsed.metrics) {
        return parsed.metrics;
      }
    } catch {
      return buildFallbackMetrics(stage, "generation-error");
    }
  }

  return buildFallbackMetrics(stage, "generation-error");
}

function studentThemesAllowed(text: string) {
  return /(student|study|learning|education|wellness|mental health|school|classroom)/i.test(text);
}

function containsBlockedTheme(text: string, allowStudentThemes: boolean) {
  if (allowStudentThemes) {
    return false;
  }

  return STUDENT_THEME_PATTERNS.some((pattern) => pattern.test(text));
}

function optionIssues(batch: RecommendationBatch, context: GenerationContext) {
  const anchors = context.track_payload_json.anchor_interests;
  const allowStudentThemes = studentThemesAllowed(JSON.stringify(context));
  const titles = new Set<string>();
  const issues: string[] = [];

  batch.recommendations.forEach((recommendation, index) => {
    const content = `${recommendation.title} ${recommendation.summary} ${recommendation.why_it_fits} ${JSON.stringify(recommendation.track_payload_json)}`;

    if (titles.has(recommendation.title.toLowerCase())) {
      issues.push(`Option ${index + 1} duplicates another title.`);
    }

    titles.add(recommendation.title.toLowerCase());

    if (!hasGrounding(content, anchors)) {
      issues.push(`Option ${index + 1} is not clearly grounded in the student's domain.`);
    }

    if (containsBlockedTheme(content, allowStudentThemes)) {
      issues.push(`Option ${index + 1} drifts into generic blocked themes.`);
    }
  });

  return issues;
}

function roadmapIssues(roadmap: RoadmapOverview, selectedOption: ProjectOption, context: GenerationContext) {
  const anchors = context.track_payload_json.anchor_interests;
  const allowStudentThemes = studentThemesAllowed(JSON.stringify(context));
  const issues: string[] = [];
  const roadmapText = `${roadmap.project_title} ${roadmap.short_overview} ${roadmap.project_brief} ${roadmap.steps.map((step) => `${step.title} ${step.objective} ${step.deliverable}`).join(" ")}`;

  if (!hasGrounding(`${roadmapText} ${selectedOption.title}`, anchors)) {
    issues.push("Roadmap is not clearly grounded in the student's domain.");
  }

  if (containsBlockedTheme(roadmapText, allowStudentThemes)) {
    issues.push("Roadmap drifts into generic blocked themes.");
  }

  roadmap.steps.forEach((step, index) => {
    if (GENERIC_STEP_TITLES.has(step.title.toLowerCase())) {
      issues.push(`Step ${index + 1} uses a generic title.`);
    }
  });

  if (roadmap.success_criteria.length < 2) {
    issues.push("Roadmap needs at least 2 success criteria.");
  }

  if (roadmap.cut_if_behind.length < 1) {
    issues.push("Roadmap needs at least 1 cut-if-behind item.");
  }

  if (issues.length > 0) {
    console.warn("roadmap validation issues", { issues, project_title: roadmap.project_title });
  }

  return issues;
}

function stepGuidanceIssues(guidance: StepGuidance, step: RoadmapStep, context: GenerationContext) {
  const anchors = context.track_payload_json.anchor_interests;
  const combined = `${guidance.what_to_do_now} ${guidance.checklist.join(" ")} ${guidance.deliverables.join(" ")} ${guidance.pitfalls.join(" ")}`;
  const issues: string[] = [];

  if (!hasGrounding(`${combined} ${step.title} ${step.objective} ${step.deliverable}`, anchors)) {
    issues.push("Guidance is not clearly grounded in the project context.");
  }

  if (guidance.checklist.length < 4) {
    issues.push("Guidance needs a fuller checklist.");
  }

  if (issues.length > 0) {
    console.warn("step guidance validation issues", { issues, step_title: step.title });
  }

  return issues;
}

function fallbackDifficulty(context: GenerationContext) {
  if (context.skill_assessment === "advanced") {
    return "intermediate_advanced" as const;
  }

  if (context.skill_assessment === "intermediate") {
    return "intermediate" as const;
  }

  return "beginner_intermediate" as const;
}

function buildSoftwareFallbackOptions(context: GenerationContext): RecommendationBatch {
  const primary = getPrimaryAnchor(context);
  const family = getDomainFamilyFromContext(context);
  const estimatedWeeks = estimateWeeksFromContext(context);
  const difficulty = fallbackDifficulty(context);

  const recipe =
    family === "hardware"
      ? [
          {
            artifact: "Trace Explorer",
            summary: `Build a focused tool for comparing ${primary.toLowerCase()} tradeoffs with visible benchmark or trace outputs.`,
            why: `This fits because it stays inside ${primary.toLowerCase()} and turns a technical workflow into one clear, demoable product.`,
            target_user: `students or hobbyists exploring ${primary.toLowerCase()} tradeoffs`,
            problem_statement: `Users need a better way to compare ${primary.toLowerCase()} decisions without scattered notes.`,
            core_workflow: "Load a small case set, compare outputs, and review the most important tradeoff in one place.",
            mvp_boundary: `One comparison view for a single ${primary.toLowerCase()} tradeoff with tabular output — no multi-project support, no advanced visualization.`,
            validation_plan: `Demo the tool on one realistic ${primary.toLowerCase()} case set and confirm the comparison output is understandable to a peer.`,
          },
          {
            artifact: "Verification Review Board",
            summary: `Create a scoped review dashboard for tracking failures, expected behavior, and fixes in ${primary.toLowerCase()} work.`,
            why: `This fits because it proves practical systems judgment without expanding into a broad platform.`,
            target_user: `students validating ${primary.toLowerCase()} experiments or builds`,
            problem_statement: `Users need a better way to track failing cases and review progress in ${primary.toLowerCase()} work.`,
            core_workflow: "Capture a failing case, label the issue, and log the next action in a single review flow.",
            mvp_boundary: `Track up to 20 failure cases with labels and next-action notes — no automated test integration, no CI pipeline hooks.`,
            validation_plan: `Log 5 real failure cases from a ${primary.toLowerCase()} project and confirm the review flow surfaces the right next action.`,
          },
          {
            artifact: "Architecture Comparison Lab",
            summary: `Ship a narrow comparison surface that explains how small ${primary.toLowerCase()} changes affect results.`,
            why: `This fits because it turns a hard-to-explain topic into a concrete product with visible output.`,
            target_user: `learners or builders studying ${primary.toLowerCase()}`,
            problem_statement: `Users need a clear way to compare a few ${primary.toLowerCase()} configurations side by side.`,
            core_workflow: "Choose two or three configurations, run the comparison, and export the key result summary.",
            mvp_boundary: `Compare up to 3 configurations with one output metric — no batch runs, no configuration history.`,
            validation_plan: `Run a side-by-side comparison on 2 real ${primary.toLowerCase()} configurations and confirm the summary is accurate.`,
          },
        ]
      : [
          {
            artifact: "Workflow Analyzer",
            summary: `Build a focused product that improves one recurring ${primary.toLowerCase()} workflow with a visible output.`,
            why: `This fits because it stays tied to the student's real interests and keeps the MVP centered on one useful action.`,
            target_user: `people working on recurring ${primary.toLowerCase()} tasks`,
            problem_statement: `Users need a better way to handle one common ${primary.toLowerCase()} workflow without manual glue work.`,
            core_workflow: "Capture a key input, run one core flow, and return one useful domain-specific output.",
            mvp_boundary: `One input type, one analysis flow, one output format — no batch processing, no multi-workflow support.`,
            validation_plan: `Run the tool on 3 realistic ${primary.toLowerCase()} inputs and confirm the output saves time compared to the manual process.`,
          },
          {
            artifact: "Decision Support Tool",
            summary: `Create a narrow decision helper for comparing a small set of ${primary.toLowerCase()} options.`,
            why: `This fits because it is finishable, grounded, and easy to explain to mentors or reviewers.`,
            target_user: `students or practitioners making ${primary.toLowerCase()} decisions`,
            problem_statement: `Users need a more transparent way to compare a few ${primary.toLowerCase()} choices.`,
            core_workflow: "Enter a few options, score them with a visible rubric, and review the recommended next step.",
            mvp_boundary: `Compare up to 5 options with one scoring rubric — no saved sessions, no collaborative features.`,
            validation_plan: `Score 3 real ${primary.toLowerCase()} options and confirm the ranking matches expert intuition.`,
          },
          {
            artifact: "Comparison Lab",
            summary: `Ship a scoped comparison workspace that makes ${primary.toLowerCase()} tradeoffs easier to inspect and share.`,
            why: `This fits because it produces a clean demo without requiring a huge feature surface.`,
            target_user: `people comparing ${primary.toLowerCase()} results or strategies`,
            problem_statement: `Users need a lightweight way to compare a few ${primary.toLowerCase()} scenarios with clear outputs.`,
            core_workflow: "Load a scenario set, compare outputs, and save the most important takeaway.",
            mvp_boundary: `Load up to 3 scenarios from manual input — no file import, no real-time collaboration.`,
            validation_plan: `Compare 2 real ${primary.toLowerCase()} scenarios and confirm the takeaway summary is shareable and accurate.`,
          },
        ];

  return RecommendationBatchSchema.parse({
    recommendations: recipe.map((item, index) => ({
      id: `${slugify(primary)}-${slugify(item.artifact)}`,
      project_track: "software" as const,
      title: `${primary} ${item.artifact}`,
      summary: item.summary,
      why_it_fits: item.why,
      difficulty,
      estimated_weeks: index === 1 ? estimatedWeeks + 1 : estimatedWeeks,
      track_payload_json: {
        target_user: item.target_user,
        problem_statement: item.problem_statement,
        core_workflow: item.core_workflow,
        mvp_boundary: item.mvp_boundary,
        validation_plan: item.validation_plan,
      },
    })),
  });
}

function buildResearchFallbackOptions(context: GenerationContext): RecommendationBatch {
  const primary = getPrimaryAnchor(context);
  const estimatedWeeks = estimateWeeksFromContext(context) + 1;
  const difficulty = fallbackDifficulty(context);

  const recipe = [
    {
      title: `What most strongly influences outcomes in ${primary}?`,
      summary: `Design a student-scale study that tests one narrow question in ${primary.toLowerCase()} with a believable evidence plan.`,
      why: `This fits because it gives the student a concrete, defensible question without pretending they have unlimited resources.`,
      research_question: `What most strongly influences outcomes in ${primary}?`,
      hypothesis_or_focus: `One measurable factor in ${primary.toLowerCase()} has an outsized effect on outcomes compared to commonly assumed drivers.`,
      methodology: "secondary data analysis",
      evidence_plan: `Use one accessible ${primary.toLowerCase()} dataset or source set.`,
      scope_boundaries: `Limit to one factor, one dataset, and one outcome measure — no multi-factor models or longitudinal tracking.`,
      limitation_note: `Findings are correlational within a single dataset and may not generalize beyond the ${primary.toLowerCase()} context studied.`,
    },
    {
      title: `Comparing two practical approaches to ${primary}`,
      summary: `Run a tightly scoped comparison study in ${primary.toLowerCase()} with one method and one clear final deliverable.`,
      why: `This fits because it stays ambitious while keeping the evidence path and final write-up manageable.`,
      research_question: `Comparing two practical approaches to ${primary}?`,
      hypothesis_or_focus: `One of two commonly used ${primary.toLowerCase()} approaches produces measurably better results on a specific criterion.`,
      methodology: "focused literature-backed comparison",
      evidence_plan: `Use one literature matrix plus a small comparison table in ${primary.toLowerCase()}.`,
      scope_boundaries: `Compare exactly two approaches on one criterion — no meta-analysis, no original data collection.`,
      limitation_note: `Comparison is limited to published evidence and may miss practitioner-specific context in ${primary.toLowerCase()}.`,
    },
    {
      title: `Building a small benchmark for better ${primary} decisions`,
      summary: `Create a narrow benchmark or rubric for evaluating one recurring ${primary.toLowerCase()} question.`,
      why: `This fits because it produces concrete findings and a portfolio-ready artifact without becoming overbroad.`,
      research_question: `Building a small benchmark for better ${primary} decisions?`,
      hypothesis_or_focus: `A structured rubric can surface clearer distinctions in ${primary.toLowerCase()} decisions than unstructured comparison.`,
      methodology: "structured rubric with lightweight analysis",
      evidence_plan: `Use a small curated case set tied to ${primary.toLowerCase()}.`,
      scope_boundaries: `One rubric, one case set of 5-10 items — no inter-rater reliability testing, no large-scale validation.`,
      limitation_note: `Rubric validity is limited to the curated case set and has not been tested across diverse ${primary.toLowerCase()} contexts.`,
    },
  ];

  return RecommendationBatchSchema.parse({
    recommendations: recipe.map((item, index) => ({
      id: `${slugify(primary)}-research-${index + 1}`,
      project_track: "research" as const,
      title: item.title,
      summary: item.summary,
      why_it_fits: item.why,
      difficulty,
      estimated_weeks: estimatedWeeks,
      track_payload_json: {
        research_question: item.research_question,
        hypothesis_or_focus: item.hypothesis_or_focus,
        methodology: item.methodology,
        evidence_plan: item.evidence_plan,
        scope_boundaries: item.scope_boundaries,
        limitation_note: item.limitation_note,
      },
    })),
  });
}

function buildFallbackRoadmap(context: GenerationContext, selectedOption: ProjectOption): RoadmapOverview {
  if (selectedOption.project_track === "research") {
    const payload = selectedOption.track_payload_json;
    return RoadmapOverviewSchema.parse({
      project_title: selectedOption.title,
      short_overview: `${selectedOption.title} is a focused research plan centered on ${payload.research_question.toLowerCase()} with a practical, student-scale evidence path.`,
      project_brief: `This project investigates ${payload.research_question.toLowerCase()} using ${payload.methodology}. The student will ${payload.evidence_plan.toLowerCase()} within the boundaries of ${payload.scope_boundaries.toLowerCase()}. Success means producing a defensible finding with honest limitations, scoped to what a student can realistically complete in ${selectedOption.estimated_weeks} weeks at ${context.track_payload_json.weekly_hours} hours per week.`,
      cut_if_behind: [
        "Secondary analysis beyond the primary dataset",
        "Additional comparison dimensions beyond the core question",
        "Extended literature review beyond the initial source set",
      ],
      success_criteria: [
        `A clear, defensible answer to ${payload.research_question.toLowerCase()}`,
        "A complete evidence trail from sources through analysis to findings",
        "An honest limitations section that acknowledges scope boundaries",
      ],
      steps: [
        {
          order_index: 0,
          title: `Lock the ${selectedOption.title} question`,
          objective: "Define the exact question, scope boundaries, and success criteria before extra exploration expands the project.",
          deliverable: "One-page question and scope brief",
          rough_time_estimate: "3-4 days",
          validation_check: "The question brief has a single answerable question, named scope boundaries, and at least 2 success criteria.",
          scope_guardrail: "Do not expand the question to cover multiple factors or populations at this stage.",
        },
        {
          order_index: 1,
          title: "Build the source and method backbone",
          objective: "Collect the core sources or evidence inputs and decide the exact method you will use.",
          deliverable: "Literature matrix or source set plus method note",
          rough_time_estimate: "1 week",
          validation_check: "The source set has at least 5 relevant entries and the method note names the exact analytical approach.",
          scope_guardrail: "Stop collecting sources once you have enough to answer the question — do not chase exhaustive coverage.",
        },
        {
          order_index: 2,
          title: "Prepare the analysis workspace",
          objective: "Set up the notebook, spreadsheet, or working doc where every analysis step and assumption will be recorded.",
          deliverable: "Ready-to-use analysis workspace with column headers and method steps listed",
          rough_time_estimate: "4-5 days",
          validation_check: "The workspace has labeled columns, a clear method sequence, and one test entry completed.",
          scope_guardrail: "Do not start actual analysis yet — this step is about structure, not findings.",
        },
        {
          order_index: 3,
          title: "Run the analysis and capture findings",
          objective: "Execute the method on the chosen evidence and produce the main tables, figures, or comparison outputs.",
          deliverable: "Findings draft with visuals or comparison table",
          rough_time_estimate: "1-2 weeks",
          validation_check: "The findings draft has at least one table or figure and a written summary of what the evidence shows.",
          scope_guardrail: "Report what the evidence actually shows — do not force a conclusion that the data does not support.",
        },
        {
          order_index: 4,
          title: "Package the final research story",
          objective: "Turn the work into a polished brief, poster, or presentation with an honest limitation section.",
          deliverable: "Final deliverable draft with limitations section",
          rough_time_estimate: "1 week",
          validation_check: "The final draft includes question, method summary, findings, and limitations — and a peer could follow the logic.",
          scope_guardrail: "Do not add new analysis at this stage — package what you have.",
        },
      ],
    });
  }

  const payload = selectedOption.track_payload_json;
  return RoadmapOverviewSchema.parse({
    project_title: selectedOption.title,
    short_overview: `${selectedOption.title} is a focused software roadmap built around ${payload.problem_statement.toLowerCase()} and a narrow MVP.`,
    project_brief: `This project builds a ${selectedOption.title.toLowerCase()} for ${payload.target_user.toLowerCase()}. The core problem is that ${payload.problem_statement.toLowerCase()}. The MVP centers on ${payload.core_workflow.toLowerCase()} within the boundary of ${payload.mvp_boundary.toLowerCase()}. The student will validate success by ${payload.validation_plan.toLowerCase()}, working ${context.track_payload_json.weekly_hours} hours per week over ${selectedOption.estimated_weeks} weeks.`,
    cut_if_behind: [
      "Visual polish beyond basic usability",
      "Secondary workflows beyond the core flow",
      "User accounts or authentication if not essential to the core workflow",
    ],
    success_criteria: [
      `The core workflow (${payload.core_workflow.toLowerCase()}) works end to end on realistic inputs`,
      `At least one user in the target group (${payload.target_user.toLowerCase()}) can complete the flow without guidance`,
      "The student can demo the project and explain the technical decisions behind it",
    ],
    steps: [
      {
        order_index: 0,
        title: `Lock the ${selectedOption.title} scope`,
        objective: "Define the user, problem, workflow, and exact MVP boundary before building features.",
        deliverable: "Product scope brief with success rubric",
        rough_time_estimate: "3-4 days",
        validation_check: "The scope brief names the target user, core workflow, MVP boundary, and at least 2 success criteria.",
        scope_guardrail: "Do not start building until the scope brief is written and reviewed.",
      },
      {
        order_index: 1,
        title: "Set up the core data and inputs",
        objective: "Build the smallest data model and input flow needed for the first usable version of the product.",
        deliverable: "Working schema and input path",
        rough_time_estimate: "1 week",
        validation_check: "The input path accepts realistic data and the schema stores it correctly.",
        scope_guardrail: "Only model data needed for the core workflow — no optional fields or future-proofing.",
      },
      {
        order_index: 2,
        title: "Build the main workflow",
        objective: "Implement the end-to-end flow that turns real inputs into the product's useful output.",
        deliverable: "Usable MVP workflow",
        rough_time_estimate: "1-2 weeks",
        validation_check: "A realistic input produces the expected output through the complete workflow.",
        scope_guardrail: "Ship the happy path first — handle edge cases only after the main flow works.",
      },
      {
        order_index: 3,
        title: "Add review and validation",
        objective: "Make the output understandable and test it on realistic examples from the domain.",
        deliverable: "Validation-ready review screen or report",
        rough_time_estimate: "1 week",
        validation_check: "At least 3 realistic examples produce correct, understandable output.",
        scope_guardrail: "Test with real domain data — do not build elaborate error handling before the happy path is validated.",
      },
      {
        order_index: 4,
        title: "Polish the demo path",
        objective: "Tighten the final user path, fix rough edges, and prepare a clear demo or walkthrough.",
        deliverable: "Demo-ready build and walkthrough notes",
        rough_time_estimate: "4-5 days",
        validation_check: "Someone unfamiliar with the project can follow the demo path and understand the product's value.",
        scope_guardrail: "Polish only the demo path — do not add features or fix non-critical bugs.",
      },
    ],
  });
}

function buildFallbackStepGuidance(
  context: GenerationContext,
  step: RoadmapStep,
  roadmap?: RoadmapOverview,
): StepGuidance {
  const anchor = context.track_payload_json.anchor_interests[0] ?? "the project domain";
  const briefRef = roadmap?.project_brief
    ? ` Keep your work aligned with the project brief: ${roadmap.project_brief.slice(0, 120)}...`
    : "";

  return StepGuidanceSchema.parse({
    what_to_do_now: `Start by turning "${step.title}" into a short working plan: name the exact output you want by the end of this step, list the inputs you already have, and identify the first blocker to remove.${briefRef}`,
    checklist: [
      `Rewrite the step objective in your own words so it is specific to ${anchor}.`,
      `Create a short checklist for the inputs, files, sources, or components this step depends on.`,
      `Block 1-2 focused work sessions and decide what progress should exist after each one.`,
      `Build or draft the smallest version of the deliverable before polishing anything.`,
      `Verify against the validation check: ${step.validation_check.toLowerCase()}.`,
      `Review the scope guardrail: ${step.scope_guardrail.toLowerCase()}.`,
    ],
    deliverables: [
      step.deliverable,
      "A dated progress note that explains what changed and what still feels uncertain.",
    ],
    pitfalls: [
      "Spending too long polishing before the first rough version exists.",
      "Letting the scope drift beyond what this single step is supposed to prove.",
      `Ignoring the scope guardrail: ${step.scope_guardrail.toLowerCase()}.`,
    ],
    tools_resources: [
      "Your current roadmap and project brief",
      "A notes doc or task tracker for decisions and blockers",
      "The smallest toolchain that lets you produce the deliverable quickly",
    ],
    done_when: [
      `You have a concrete version of ${step.deliverable.toLowerCase()}.`,
      `The validation check passes: ${step.validation_check.toLowerCase()}.`,
    ],
    encouragement: "Keep this step narrow. A believable rough version completed on time is much stronger than an overbuilt version that stalls.",
    email_version: {
      subject: `Sevri check-in: ${step.title}`,
      preview: `A quick plan for making progress on ${step.deliverable.toLowerCase()}.`,
      body: `Focus on one clear output for ${step.title}. Start small, log your decisions, and aim to leave this step with ${step.deliverable.toLowerCase()} plus a short note on what comes next.`,
    },
  });
}

function normalizeRoadmapSteps(roadmap: RoadmapOverview): RoadmapOverview {
  return {
    ...roadmap,
    steps: roadmap.steps.map((step, index) => ({
      ...step,
      order_index: index,
    })),
  };
}

export async function runOptionsGeneration(context: GenerationContext): Promise<PipelineResult<RecommendationBatch>> {
  try {
    const result = await generateStructuredOutput({
      stage: "options",
      schema: RecommendationBatchSchema,
      schemaName: `${context.project_track}_options`,
      systemPrompt: buildOptionsSystemPrompt(context.project_track),
      userPrompt: buildOptionsUserPrompt(context),
      validator: (parsed) => optionIssues(parsed, context),
    });

    return {
      parsed: result.parsed,
      raw: result.raw,
      metrics: result.metrics,
    };
  } catch (error) {
    console.warn("options generation failed, using fallback", { error: error instanceof Error ? error.message : error });
    const parsed = context.project_track === "research" ? buildResearchFallbackOptions(context) : buildSoftwareFallbackOptions(context);
    const metrics = getFailureMetrics(error, "options");

    return {
      parsed,
      raw: {
        source: "fallback",
        stage: "options",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      metrics: { ...metrics, fallback_used: true },
    };
  }
}

export async function runRoadmapGeneration(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
}): Promise<PipelineResult<RoadmapOverview>> {
  try {
    const result = await generateStructuredOutput({
      stage: "roadmap",
      schema: RoadmapOverviewSchema,
      schemaName: `${input.context.project_track}_roadmap_overview`,
      systemPrompt: buildRoadmapSystemPrompt(input.context.project_track),
      userPrompt: buildRoadmapUserPrompt({
        projectTrack: input.context.project_track,
        context: input.context,
        selectedOption: input.selectedOption,
      }),
      validator: (parsed) => roadmapIssues(parsed, input.selectedOption, input.context),
    });

    return {
      parsed: normalizeRoadmapSteps(result.parsed),
      raw: result.raw,
      metrics: result.metrics,
    };
  } catch (error) {
    console.warn("roadmap generation failed, using fallback", { error: error instanceof Error ? error.message : error });
    const parsed = buildFallbackRoadmap(input.context, input.selectedOption);
    const metrics = getFailureMetrics(error, "roadmap");

    return {
      parsed,
      raw: {
        source: "fallback",
        stage: "roadmap",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      metrics: { ...metrics, fallback_used: true },
    };
  }
}

export async function runStepGuidanceGeneration(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  roadmap: RoadmapOverview;
  step: RoadmapStep;
  previousStep?: RoadmapStep;
  nextStep?: RoadmapStep;
}): Promise<PipelineResult<StepGuidance>> {
  try {
    const result = await generateStructuredOutput({
      stage: "step_guidance",
      schema: StepGuidanceSchema,
      schemaName: `${input.context.project_track}_step_guidance`,
      systemPrompt: buildStepGuidanceSystemPrompt(input.context.project_track),
      userPrompt: buildStepGuidanceUserPrompt(input),
      validator: (parsed) => stepGuidanceIssues(parsed, input.step, input.context),
    });

    return {
      parsed: result.parsed,
      raw: result.raw,
      metrics: result.metrics,
    };
  } catch (error) {
    console.warn("step guidance generation failed, using fallback", { error: error instanceof Error ? error.message : error, step_title: input.step.title });
    const parsed = buildFallbackStepGuidance(input.context, input.step, input.roadmap);
    const metrics = getFailureMetrics(error, "step_guidance");

    return {
      parsed,
      raw: {
        source: "fallback",
        stage: "step_guidance",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      metrics: { ...metrics, fallback_used: true },
    };
  }
}

export function getRouteGenerationMetadata(input: {
  metrics: GenerationMetrics;
  routeTotalMs: number;
  cacheHit?: boolean;
}) {
  return {
    stage: input.metrics.stage,
    generation_version: input.metrics.generation_version,
    model: input.metrics.model,
    attempt_count: input.metrics.attempt_count,
    fallback_used: input.metrics.fallback_used,
    cache_hit: input.cacheHit ?? false,
    route_total_ms: Math.round(input.routeTotalMs),
    ai_total_ms: input.metrics.ai_total_ms,
    validation_ms: input.metrics.validation_ms,
    prompt_chars: input.metrics.prompt_chars,
    output_chars: input.metrics.output_chars,
  };
}

export function getDefaultLegacyTimingSummary() {
  return {
    options_ms: 180_000,
    roadmap_ms: 180_000,
  };
}

export function getWeeklyHoursForStorage(context: GenerationContext) {
  return estimateWeeklyHoursFromContext(context);
}
