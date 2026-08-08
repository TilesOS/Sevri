import {
  buildNormalizeSystemPrompt,
  buildNormalizeUserPrompt,
  buildOptionsSystemPrompt,
  buildOptionsUserPrompt,
  buildRoadmapSystemPrompt,
  buildRoadmapUserPrompt,
  buildStepGuidanceSystemPrompt,
  buildStepGuidanceUserPrompt,
  buildWorkEvaluationSystemPrompt,
  buildWorkEvaluationUserPrompt,
  type PromptFeedbackItem,
} from "@/lib/ai/prompts";
import {
  generateStructuredOutput,
  getGenerationVersion,
  type GenerationCitation,
  type GenerationMetrics,
  type WebSearchPolicy,
} from "@/lib/ai/client";
import {
  estimateWeeklyHoursFromContext,
  hasGrounding,
} from "@/lib/ai/generation-context";
import {
  ResearchGenerationContextSchema,
  CommonAppActivitySchema,
  RecommendationBatchSchema,
  ResumeBulletsSchema,
  RoadmapGenerationSchema,
  SoftwareGenerationContextSchema,
  StepGuidanceSchema,
  WorkEvaluationSchema,
  WorkPortfolioCurationSchema,
  type CommonAppActivity,
  type GenerationContext,
  type ProjectTrack,
  type ProjectOption,
  type RecommendationBatch,
  type ResumeBullets,
  type RoadmapOverview,
  type RoadmapStep,
  type StepGuidance,
  type WorkEvaluation,
  type WorkPortfolioCuration,
} from "@/lib/ai/schemas";
import {
  COMMON_APP_ACTIVITY_QUALITY_SPEC,
  OPTIONS_QUALITY_SPEC,
  RESUME_BULLETS_QUALITY_SPEC,
  ROADMAP_QUALITY_SPEC,
  STEP_GUIDANCE_QUALITY_SPEC,
  WORK_EVALUATION_QUALITY_SPEC,
  WORK_PORTFOLIO_CURATION_QUALITY_SPEC,
  buildAllowedTerms,
} from "@/lib/ai/content-quality-specs";
import { formatLintIssues, lintProse, type ContentLintCode } from "@/lib/text/content-lint";

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
  citations: GenerationCitation[];
  refusal: string | null;
}

export interface PortfolioPipelineInput {
  project: {
    title: string;
    status: string;
    project_track: ProjectTrack | string;
  };
  roadmap: RoadmapOverview | null;
  milestones: Array<{
    id: string;
    order_index: number;
    title: string;
    description?: string | null;
    completed: boolean;
    completed_at?: string | null;
  }>;
  submissions: Array<{
    id: string;
    milestone_id: string;
    submission_text: string | null;
    submission_filename: string | null;
    created_at: string;
  }>;
  latestEvaluations: Array<{
    submission_id: string;
    evaluation_json: unknown;
    status: string;
  }>;
  reviews: Array<{
    milestone_id: string;
    strength: string;
    tighten: string;
    next_action: string;
    ready_to_mark_complete: boolean;
  }>;
  cachedCommits: Array<{
    sha: string;
    shortSha: string;
    title: string;
    body: string;
    authoredAt: string | null;
  }>;
  existingReflection: string | null;
  existingCuratedSummary?: string | null;
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
    fallback_model_used: null,
    validator_failed: false,
    validator_issue_count: 0,
    tool_used: false,
    web_search_used: false,
    citation_count: 0,
    refusal_detected: false,
    quality_issue_count: 0,
    quality_issue_kinds: [],
    quality_repair_used: false,
    quality_escalation_used: false,
    quality_fallback_used: false,
    title_regenerated: false,
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

const RECENCY_SENSITIVE_PATTERN =
  /\b(latest|recent|current|up[-\s]?to[-\s]?date|newest|state[-\s]?of[-\s]?the[-\s]?art|202[4-9])\b/i;
const RESEARCH_SOURCE_SEEKING_PATTERN =
  /\b(paper|papers|dataset|datasets|benchmark|benchmarks|literature|survey|arxiv|source set|evidence)\b/i;
const SOFTWARE_SOURCE_SEEKING_PATTERN =
  /\b(api|apis|sdk|sdks|framework|frameworks|library|libraries|tooling|integration|integrations|package|packages|dependency|dependencies|version|versions)\b/i;

function appendExternalSearchGuidance(basePrompt: string, policy?: WebSearchPolicy) {
  if (!policy?.enabled) {
    return basePrompt;
  }

  const reasonLine =
    policy.reason === "learning_resources"
      ? "Use web search to find and verify every learning-resource URL before returning the roadmap."
      : policy.reason === "recency_sensitive"
      ? "Use web search only where current or recent external information materially improves the answer."
      : policy.reason === "source_seeking"
        ? "Use web search only where external sources, papers, datasets, or API references materially improve the answer."
        : "Use web search only where the user explicitly asked for current external information.";

  return [
    basePrompt,
    "External search guidance:",
    `- ${reasonLine}`,
    "- Ground any externally sourced claims in retrieved sources.",
    "- Copy resource URLs only from retrieved sources; never guess a URL.",
    "- Keep source-backed claims concise so citations can be surfaced cleanly in the response.",
    "- Do not replace the student's project context with generic web information.",
  ].join("\n\n");
}

function detectStepGuidanceWebSearchPolicy(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  roadmap: RoadmapOverview;
  step: RoadmapStep;
  previousStep?: RoadmapStep;
  nextStep?: RoadmapStep;
}): WebSearchPolicy | undefined {
  const combined = [
    input.context.summary,
    input.selectedOption.title,
    input.selectedOption.summary,
    JSON.stringify(input.selectedOption.track_payload_json),
    input.roadmap.project_title,
    input.roadmap.project_brief,
    input.step.title,
    input.step.objective,
    input.step.deliverable,
    input.step.validation_check,
    input.previousStep?.deliverable ?? "",
    input.nextStep?.objective ?? "",
  ].join(" ");

  if (RECENCY_SENSITIVE_PATTERN.test(combined)) {
    return { enabled: true, reason: "recency_sensitive" };
  }

  const sourceSeekingPattern =
    input.selectedOption.project_track === "research" ? RESEARCH_SOURCE_SEEKING_PATTERN : SOFTWARE_SOURCE_SEEKING_PATTERN;

  if (sourceSeekingPattern.test(combined)) {
    return { enabled: true, reason: "source_seeking" };
  }

  return undefined;
}

function containsBlockedTheme(text: string, allowStudentThemes: boolean) {
  if (allowStudentThemes) {
    return false;
  }

  return STUDENT_THEME_PATTERNS.some((pattern) => pattern.test(text));
}

const GENERIC_TITLE_PATTERNS = [
  /^smart\s/i,
  /^ai[- ]powered\s/i,
  /^automated\s/i,
  /\bplatform$/i,
  /\bhub$/i,
  /\bsuite$/i,
  /\bmanager$/i,
  /^intelligent\s/i,
  /^universal\s/i,
];

function optionIssues(batch: RecommendationBatch, context: GenerationContext) {
  const anchors = context.track_payload_json.anchor_interests;
  const allowStudentThemes = studentThemesAllowed(JSON.stringify(context));
  const titles = new Set<string>();
  const shapeKeys = new Set<string>();
  const issues: string[] = [];

  batch.recommendations.forEach((recommendation, index) => {
    const content = `${recommendation.title} ${recommendation.summary} ${recommendation.why_it_fits} ${JSON.stringify(recommendation.track_payload_json)}`;
    const shapeKey =
      recommendation.project_track === "research"
        ? `${recommendation.track_payload_json.methodology.toLowerCase()}|${recommendation.track_payload_json.research_question.toLowerCase().slice(0, 80)}`
        : `${recommendation.track_payload_json.target_user.toLowerCase().slice(0, 80)}|${recommendation.track_payload_json.problem_statement.toLowerCase().slice(0, 80)}|${recommendation.track_payload_json.core_workflow.toLowerCase().slice(0, 80)}`;

    if (titles.has(recommendation.title.toLowerCase())) {
      issues.push(`Option ${index + 1} duplicates another title.`);
    }

    titles.add(recommendation.title.toLowerCase());

    if (shapeKeys.has(shapeKey)) {
      issues.push(`Option ${index + 1} is too close to another option's core shape.`);
    }

    shapeKeys.add(shapeKey);

    if (!hasGrounding(content, anchors)) {
      issues.push(`Option ${index + 1} is not clearly grounded in the student's domain.`);
    }

    if (containsBlockedTheme(content, allowStudentThemes)) {
      issues.push(`Option ${index + 1} drifts into generic blocked themes.`);
    }

    if (GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(recommendation.title))) {
      issues.push(`Option ${index + 1} uses a generic title pattern — make it specific to the domain.`);
    }

    if (!hasGrounding(recommendation.why_it_fits, anchors)) {
      issues.push(`Option ${index + 1} why_it_fits should reference the student's domain language.`);
    }

    if (recommendation.finishability_score >= 9 && context.risk_flags.some((flag) => flag === "too_little_time" || flag === "too_ambitious")) {
      issues.push(`Option ${index + 1} overstates finishability for the student's constraints.`);
    }

    if (recommendation.skills_demonstrated.length < 2 || recommendation.tools_needed.length < 2) {
      issues.push(`Option ${index + 1} needs more concrete skills/tools detail.`);
    }
  });

  const expectedDifficultyLadder = ["beginner", "intermediate", "advanced"] as const;
  batch.recommendations.forEach((recommendation, index) => {
    if (recommendation.difficulty !== expectedDifficultyLadder[index]) {
      issues.push(
        `Option ${index + 1} must be the ${expectedDifficultyLadder[index]} comparison tier so the board reads focused -> stretch -> ambitious.`,
      );
    }
  });

  const [focused, , ambitious] = batch.recommendations;
  if (focused.finishability_score <= ambitious.finishability_score) {
    issues.push("The focused option must be more finishable than the ambitious option.");
  }
  if (ambitious.impressiveness_score <= focused.impressiveness_score) {
    issues.push("The ambitious option must have a stronger credible impact or portfolio ceiling than the focused option.");
  }

  if (new Set(batch.recommendations.map((recommendation) => recommendation.estimated_weeks)).size < 2) {
    issues.push("The batch needs more timeline differentiation.");
  }

  if (context.project_track === "software") {
    const targetUsers = batch.recommendations
      .filter((r): r is typeof r & { project_track: "software" } => r.project_track === "software")
      .map((r) => r.track_payload_json.target_user.toLowerCase().slice(0, 60));
    if (new Set(targetUsers).size < 3) {
      issues.push("All three software options should target meaningfully different users or user segments.");
    }
  }

  return issues;
}

function normalizedContextIssues(context: GenerationContext) {
  const payload = context.track_payload_json;
  const issues: string[] = [];

  if (!hasGrounding(`${context.summary} ${payload.domain_brief} ${payload.focus_signal}`, payload.anchor_interests)) {
    issues.push("Normalized profile is not clearly grounded in the user's domain.");
  }

  if (payload.anti_generic_warnings.length < 2) {
    issues.push("Normalized profile needs stronger anti-generic warnings.");
  }

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

  issues.push(...pitchKitIssues(roadmap.pitch_kit));

  if (issues.length > 0) {
    console.warn("roadmap validation issues", { issues, project_title: roadmap.project_title });
  }

  return issues;
}

function canonicalSourceUrl(value: string) {
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return value;
  }
}

function learningResourceEvidenceIssues(roadmap: RoadmapOverview, citations: GenerationCitation[]) {
  const resources = roadmap.learning_resources ?? [];
  const issues: string[] = [];
  const sourceUrls = new Set(citations.map((citation) => canonicalSourceUrl(citation.url)));
  const resourceUrls = new Set<string>();

  for (const resource of resources) {
    const canonical = canonicalSourceUrl(resource.url);
    if (resourceUrls.has(canonical)) {
      issues.push(`Learning resource URL is duplicated: ${resource.url}`);
    }
    resourceUrls.add(canonical);

    if (!sourceUrls.has(canonical)) {
      issues.push(`Learning resource URL was not present in the retrieved web-search sources: ${resource.url}`);
    }

    if (resource.use_during_step > roadmap.steps.length) {
      issues.push(`Learning resource "${resource.title}" points to a step that does not exist.`);
    }
  }

  const stages = new Set(resources.map((resource) => resource.learning_stage));
  for (const requiredStage of ["start_here", "build_with", "go_deeper"] as const) {
    if (!stages.has(requiredStage)) {
      issues.push(`Learning resources must include the ${requiredStage} stage.`);
    }
  }

  if (resources.filter((resource) => resource.learning_stage === "build_with").length < 2) {
    issues.push("Learning resources must include at least two build_with sources.");
  }

  if (new Set(resources.map((resource) => resource.provider.toLowerCase())).size < 3) {
    issues.push("Learning resources must draw from at least three credible providers.");
  }

  return issues;
}

/**
 * Voice and phrasing failures the model must fix rather than have repaired.
 *
 * Deliberately narrower than the full lint: punctuation-level problems are
 * already covered by `ROADMAP_QUALITY_SPEC`, which degrades to a deterministic
 * cleanup instead of failing generation outright. These codes have no safe
 * automatic repair, so they are worth a retry.
 */
const PITCH_KIT_BLOCKING_LINT_CODES: ReadonlySet<ContentLintCode> = new Set([
  "stitched_period_connector",
  "stitched_question_mark",
  "third_person_student",
  "internal_vocabulary",
  "template_placeholder",
]);

/**
 * The pitch kit is the copy the student reads aloud, so it is held to the same
 * standard the deterministic composers must meet: second person, no internal
 * vocabulary, no stitched-template artifacts.
 *
 * If a retry still cannot satisfy this, `buildRoadmapStorageArtifacts` falls back
 * to a labeled deterministic draft, so broken copy is never stored either way.
 */
function pitchKitIssues(pitchKit: RoadmapOverview["pitch_kit"]): string[] {
  if (!pitchKit) {
    return [];
  }

  const issues: string[] = [];
  const fields: Array<[string, string]> = [
    ["pitch_kit.elevator_pitch", pitchKit.elevator_pitch],
    ...pitchKit.resume_bullets.map(
      (bullet, index) => [`pitch_kit.resume_bullets[${index}]`, bullet] as [string, string],
    ),
    ...pitchKit.talking_points.map(
      (point, index) => [`pitch_kit.talking_points[${index}].body`, point.body] as [string, string],
    ),
  ];

  for (const [path, value] of fields) {
    const blocking = lintProse(value).filter((issue) =>
      PITCH_KIT_BLOCKING_LINT_CODES.has(issue.code),
    );
    if (blocking.length > 0) {
      issues.push(
        `${path} reads poorly: ${formatLintIssues(blocking)}. Rewrite it as finished prose addressing the student as "you".`,
      );
    }
  }

  return issues;
}

function stepGuidanceIssues(guidance: StepGuidance, step: RoadmapStep, context: GenerationContext) {
  const anchors = context.track_payload_json.anchor_interests;
  const combined = `${guidance.what_to_do_now} ${guidance.checklist.join(" ")} ${guidance.pitfalls.join(" ")} ${guidance.done_when.join(" ")}`;
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

function normalizeRoadmapSteps(roadmap: RoadmapOverview): RoadmapOverview {
  return {
    ...roadmap,
    steps: roadmap.steps.map((step, index) => ({
      ...step,
      order_index: index,
    })),
  };
}

export async function runProfileNormalization(input: {
  projectTrack: ProjectTrack;
  rawIntake: Record<string, unknown>;
  feedback?: PromptFeedbackItem[];
}): Promise<PipelineResult<GenerationContext>> {
  const rawExperience = String(
    input.projectTrack === "research" ? input.rawIntake.research_experience : input.rawIntake.coding_experience,
  ).toLowerCase();
  const currentExperience = ["beginner", "intermediate", "advanced"].includes(rawExperience)
    ? rawExperience
    : "intermediate";
  const rawPreferredChallenge = String(input.rawIntake.preferred_difficulty ?? "").toLowerCase();
  const preferredChallenge = ["beginner", "intermediate", "advanced"].includes(rawPreferredChallenge)
    ? rawPreferredChallenge
    : currentExperience;
  const result = await generateStructuredOutput({
    stage: "normalize",
    schema: input.projectTrack === "research" ? ResearchGenerationContextSchema : SoftwareGenerationContextSchema,
    schemaName: `${input.projectTrack}_normalized_context`,
    systemPrompt: buildNormalizeSystemPrompt(input.projectTrack),
    userPrompt: buildNormalizeUserPrompt(input),
    validator: (parsed) => [
      ...normalizedContextIssues(parsed),
      ...(parsed.skill_assessment === currentExperience
        ? []
        : [`Current experience must remain ${currentExperience}; do not infer a different skill level.`]),
      ...(parsed.track_payload_json.preferred_challenge === preferredChallenge
        ? []
        : [`Preferred challenge must remain ${preferredChallenge}; do not infer a different challenge preference.`]),
    ],
  });

  return {
    parsed: result.parsed,
    raw: result.raw,
    metrics: result.metrics,
    citations: result.citations,
    refusal: result.refusal,
  };
}

export async function runOptionsGeneration(
  context: GenerationContext,
  feedback?: PromptFeedbackItem[],
): Promise<PipelineResult<RecommendationBatch>> {
  const result = await generateStructuredOutput({
    stage: "options",
    schema: RecommendationBatchSchema,
    schemaName: `${context.project_track}_options`,
    systemPrompt: buildOptionsSystemPrompt(context.project_track),
    userPrompt: buildOptionsUserPrompt(context, feedback),
    validator: (parsed) => optionIssues(parsed, context),
    qualitySpec: OPTIONS_QUALITY_SPEC,
    qualityAllowedTerms: buildAllowedTerms(context),
  });

  return {
    parsed: result.parsed,
    raw: result.raw,
    metrics: result.metrics,
    citations: result.citations,
    refusal: result.refusal,
  };
}

export async function runRoadmapGeneration(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  feedback?: PromptFeedbackItem[];
}): Promise<PipelineResult<RoadmapOverview>> {
  const webSearch: WebSearchPolicy = {
    enabled: true,
    required: true,
    reason: "learning_resources",
  };
  const result = await generateStructuredOutput({
    stage: "roadmap",
    schema: RoadmapGenerationSchema,
    schemaName: `${input.context.project_track}_roadmap_overview`,
    systemPrompt: buildRoadmapSystemPrompt(input.context.project_track),
    userPrompt: appendExternalSearchGuidance(
      buildRoadmapUserPrompt({
        projectTrack: input.context.project_track,
        context: input.context,
        selectedOption: input.selectedOption,
        feedback: input.feedback,
      }),
      webSearch,
    ),
    validator: (parsed) => roadmapIssues(parsed, input.selectedOption, input.context),
    evidenceValidator: learningResourceEvidenceIssues,
    webSearch,
    qualitySpec: ROADMAP_QUALITY_SPEC,
    qualityAllowedTerms: buildAllowedTerms(input.context),
  });

  return {
    parsed: normalizeRoadmapSteps(result.parsed),
    raw: result.raw,
    metrics: result.metrics,
    citations: result.citations,
    refusal: result.refusal,
  };
}

export async function runStepGuidanceGeneration(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  roadmap: RoadmapOverview;
  step: RoadmapStep;
  previousStep?: RoadmapStep;
  nextStep?: RoadmapStep;
  feedback?: PromptFeedbackItem[];
}): Promise<PipelineResult<StepGuidance>> {
  const webSearch = detectStepGuidanceWebSearchPolicy(input);
  const result = await generateStructuredOutput({
    stage: "step_guidance",
    schema: StepGuidanceSchema,
    schemaName: `${input.context.project_track}_step_guidance`,
    systemPrompt: buildStepGuidanceSystemPrompt(input.context.project_track, input.step.order_index, input.roadmap.steps.length),
    userPrompt: appendExternalSearchGuidance(buildStepGuidanceUserPrompt(input), webSearch),
    validator: (parsed) => stepGuidanceIssues(parsed, input.step, input.context),
    webSearch,
    qualitySpec: STEP_GUIDANCE_QUALITY_SPEC,
    qualityAllowedTerms: buildAllowedTerms(input.context),
  });

  return {
    parsed: result.parsed,
    raw: result.raw,
    metrics: result.metrics,
    citations: result.citations,
    refusal: result.refusal,
  };
}

export async function runWorkEvaluation(input: {
  context: GenerationContext;
  step: RoadmapStep;
  guidance: StepGuidance;
  submissionText: string;
  submissionFilename?: string;
}): Promise<PipelineResult<WorkEvaluation>> {
  try {
    const result = await generateStructuredOutput({
      stage: "work_evaluation",
      schema: WorkEvaluationSchema,
      schemaName: `${input.context.project_track}_work_evaluation`,
      systemPrompt: buildWorkEvaluationSystemPrompt(input.context.project_track),
      userPrompt: buildWorkEvaluationUserPrompt({
        step: input.step,
        guidance: input.guidance,
        submissionText: input.submissionText,
        submissionFilename: input.submissionFilename,
      }),
      qualitySpec: WORK_EVALUATION_QUALITY_SPEC,
      qualityAllowedTerms: buildAllowedTerms(input.context),
    });

    return {
      parsed: result.parsed,
      raw: result.raw,
      metrics: result.metrics,
      citations: result.citations,
      refusal: result.refusal,
    };
  } catch (error) {
    console.warn("work evaluation failed, using fallback", { error: error instanceof Error ? error.message : error });
    const metrics = getFailureMetrics(error, "work_evaluation");

    const parsed: WorkEvaluation = {
      criterion_verdicts: [{
        criterion: input.step.validation_check,
        verdict: "not_yet",
        note: "Evaluation could not be completed. Please resubmit to try again.",
      }],
      overall_assessment: "The evaluation failed due to a technical issue. Your submission was saved — resubmit to get a full evaluation.",
      strongest_aspect: "Unable to assess at this time.",
      clearest_gap: "Unable to assess at this time.",
      next_best_action: "Resubmit your work to get a complete evaluation.",
      ready_to_mark_complete: false,
    };

    return {
      parsed,
      raw: {
        source: "fallback",
        stage: "work_evaluation",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      metrics: { ...metrics, fallback_used: true },
      citations: [],
      refusal: null,
    };
  }
}

const CONSERVATIVE_OUTPUT_LANGUAGE = [
  "Prefer understatement over overclaiming.",
  "Never invent quantitative results the submissions do not support.",
  "Prefer ‘built a tool that helped me understand X’ over ‘improved outcomes by 40%’ unless a specific number appears in the student’s submissions.",
  "If unsure whether evidence supports a specific claim, omit it.",
] as const;

function formatPortfolioSystemPrompt(task: string) {
  return [
    task,
    "Return only JSON that matches the schema.",
    "Use only the supplied roadmap, submissions, latest completed evaluations, reviewer feedback, cached Git commits, and student reflection.",
    "Do not fetch external sources. Do not infer outcomes, awards, users, metrics, deployments, revenue, grades, or institutional impact unless the supplied evidence states them.",
    ...CONSERVATIVE_OUTPUT_LANGUAGE,
    "Every prose field must be a complete thought ending in terminal punctuation. Avoid mojibake, broken characters, placeholder text, and truncated sentences.",
  ].join(" ");
}

function truncateForPrompt(value: string | null | undefined, maxLength: number) {
  if (!value) return "";
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trim()}...`;
}

function compactJson(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return "";
  try {
    return truncateForPrompt(JSON.stringify(value), maxLength);
  } catch {
    return "";
  }
}

function formatPortfolioEvidence(input: PortfolioPipelineInput) {
  const roadmapSummary = input.roadmap
    ? [
        `Roadmap title: ${input.roadmap.project_title}`,
        `Roadmap overview: ${input.roadmap.short_overview}`,
        `Project brief: ${input.roadmap.project_brief}`,
        `Success criteria: ${input.roadmap.success_criteria.join(" | ")}`,
      ].join("\n")
    : "No roadmap is available.";

  const milestoneById = new Map(input.milestones.map((milestone) => [milestone.order_index, milestone]));
  const milestoneLines = input.milestones
    .map((milestone) => {
      const completed = milestone.completed ? "completed" : "not completed";
      return `Step ${milestone.order_index + 1}: ${milestone.title} (${completed}).`;
    })
    .join("\n") || "No milestones are available.";

  const submissionLines = input.submissions
    .slice(0, 8)
    .map((submission) => {
      const milestone = input.milestones.find((item) => item.id === submission.milestone_id);
      const stepLabel = milestone ? `Step ${milestone.order_index + 1}` : "Unknown step";
      return [
        `${stepLabel} submission ${submission.submission_filename ? `(${submission.submission_filename})` : ""}:`,
        truncateForPrompt(submission.submission_text, 1400),
      ].join("\n");
    })
    .join("\n\n") || "No submissions are available.";

  const evaluationLines = input.latestEvaluations
    .slice(0, 8)
    .map((evaluation) => compactJson(evaluation.evaluation_json, 900))
    .filter(Boolean)
    .join("\n") || "No completed evaluations are available.";

  const reviewLines = input.reviews
    .slice(0, 8)
    .map((review) => {
      const milestone = Array.from(milestoneById.values()).find((item) => item.id === review.milestone_id);
      const stepLabel = milestone ? `Step ${milestone.order_index + 1}` : "Unknown step";
      return `${stepLabel}: Strength: ${review.strength} Tighten: ${review.tighten} Next action: ${review.next_action}`;
    })
    .join("\n") || "No reviewer feedback is available.";

  const commitLines = input.cachedCommits
    .slice(0, 10)
    .map((commit) => `${commit.shortSha}: ${commit.title}${commit.body ? ` - ${truncateForPrompt(commit.body, 180)}` : ""}`)
    .join("\n") || "No cached GitHub commits are available.";

  return [
    "Project:",
    `Title: ${input.project.title}`,
    `Track: ${input.project.project_track}`,
    `Status: ${input.project.status}`,
    "",
    "Roadmap:",
    roadmapSummary,
    "",
    "Milestones:",
    milestoneLines,
    "",
    "Student reflection:",
    truncateForPrompt(input.existingReflection, 1400) || "No student reflection is available.",
    "",
    "Latest submissions:",
    submissionLines,
    "",
    "Latest completed evaluations:",
    evaluationLines,
    "",
    "Non-superseded reviewer feedback:",
    reviewLines,
    "",
    "Cached Git commits:",
    commitLines,
    "",
    input.existingCuratedSummary ? `Existing curation: ${truncateForPrompt(input.existingCuratedSummary, 900)}` : "",
  ].filter((line) => line !== "").join("\n");
}

function quantitativeClaimIssues(text: string, evidence: string) {
  const issues: string[] = [];
  const evidenceText = evidence.toLowerCase();
  const percentMatches = text.match(/\b\d+(?:\.\d+)?\s?%/g) ?? [];

  for (const match of percentMatches) {
    if (!evidenceText.includes(match.toLowerCase())) {
      issues.push(`Unsupported quantitative claim "${match}" does not appear in the supplied evidence.`);
    }
  }

  return issues;
}

export async function runPortfolioCuration(
  input: PortfolioPipelineInput,
): Promise<PipelineResult<WorkPortfolioCuration>> {
  const evidence = formatPortfolioEvidence(input);
  const result = await generateStructuredOutput({
    stage: "portfolio_curation",
    schema: WorkPortfolioCurationSchema,
    schemaName: "work_portfolio_curation",
    systemPrompt: formatPortfolioSystemPrompt(
      "You write concise private Portfolio curation for a student's longitudinal project record.",
    ),
    userPrompt: [
      evidence,
      "Task:",
      "Write one understated curated_summary in 2-4 sentences. Name what the student built or investigated, the strongest concrete evidence, and the current maturity of the work. Never claim public impact unless the evidence states it.",
    ].join("\n\n"),
    validator: (parsed) => quantitativeClaimIssues(parsed.curated_summary, evidence),
    qualitySpec: WORK_PORTFOLIO_CURATION_QUALITY_SPEC,
    qualityAllowedTerms: buildAllowedTerms(null),
  });

  return {
    parsed: result.parsed,
    raw: result.raw,
    metrics: result.metrics,
    citations: result.citations,
    refusal: result.refusal,
  };
}

export async function runCommonAppActivityExport(
  input: PortfolioPipelineInput,
): Promise<PipelineResult<CommonAppActivity>> {
  const evidence = formatPortfolioEvidence(input);
  const result = await generateStructuredOutput({
    stage: "portfolio_export",
    schema: CommonAppActivitySchema,
    schemaName: "common_app_activity_export",
    systemPrompt: formatPortfolioSystemPrompt(
      "You convert one Sevri project into a conservative Common App activity draft.",
    ),
    userPrompt: [
      evidence,
      "Task:",
      "Draft a Common App activity entry for this single project. Keep details at 150 characters or fewer. If hours per week or weeks per year are not explicitly evidenced, use 0. The activity should sound credible for a student, not like marketing copy.",
    ].join("\n\n"),
    validator: (parsed) => quantitativeClaimIssues(parsed.details, evidence),
    qualitySpec: COMMON_APP_ACTIVITY_QUALITY_SPEC,
    qualityAllowedTerms: buildAllowedTerms(null),
  });

  return {
    parsed: result.parsed,
    raw: result.raw,
    metrics: result.metrics,
    citations: result.citations,
    refusal: result.refusal,
  };
}

export async function runResumeBulletsExport(
  input: PortfolioPipelineInput,
): Promise<PipelineResult<ResumeBullets>> {
  const evidence = formatPortfolioEvidence(input);
  const result = await generateStructuredOutput({
    stage: "portfolio_export",
    schema: ResumeBulletsSchema,
    schemaName: "resume_bullets_export",
    systemPrompt: formatPortfolioSystemPrompt(
      "You convert one Sevri project into conservative resume bullets.",
    ),
    userPrompt: [
      evidence,
      "Task:",
      "Write 2-4 resume bullets. Start with concrete action verbs, describe the artifact and evidence, and avoid inflated impact language. Do not include unsupported percentages or user counts.",
    ].join("\n\n"),
    validator: (parsed) => parsed.bullets.flatMap((bullet) => quantitativeClaimIssues(bullet, evidence)),
    qualitySpec: RESUME_BULLETS_QUALITY_SPEC,
    qualityAllowedTerms: buildAllowedTerms(null),
  });

  return {
    parsed: result.parsed,
    raw: result.raw,
    metrics: result.metrics,
    citations: result.citations,
    refusal: result.refusal,
  };
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
    fallback_model_used: input.metrics.fallback_model_used,
    validator_failed: input.metrics.validator_failed,
    validator_issue_count: input.metrics.validator_issue_count,
    tool_used: input.metrics.tool_used,
    web_search_used: input.metrics.web_search_used,
    citation_count: input.metrics.citation_count,
    refusal_detected: input.metrics.refusal_detected,
    quality_issue_count: input.metrics.quality_issue_count,
    quality_issue_kinds: input.metrics.quality_issue_kinds,
    quality_repair_used: input.metrics.quality_repair_used,
    quality_escalation_used: input.metrics.quality_escalation_used,
    quality_fallback_used: input.metrics.quality_fallback_used,
    title_regenerated: input.metrics.title_regenerated,
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
