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
  buildGenerationContext,
  estimateWeeksFromContext,
  estimateWeeklyHoursFromContext,
  getDomainFamilyFromContext,
  getPrimaryAnchor,
  hasGrounding,
  slugify,
} from "@/lib/ai/generation-context";
import {
  ResearchGenerationContextSchema,
  RecommendationBatchSchema,
  RoadmapOverviewSchema,
  SoftwareGenerationContextSchema,
  StepGuidanceSchema,
  WorkEvaluationSchema,
  type GenerationContext,
  type ProjectTrack,
  type ProjectOption,
  type RecommendationBatch,
  type RoadmapOverview,
  type RoadmapStep,
  type StepGuidance,
  type WorkEvaluation,
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
  citations: GenerationCitation[];
  refusal: string | null;
}

function contextSeed(context: GenerationContext): number {
  const str = context.summary + context.track_payload_json.domain_brief;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function selectFromPool<T>(pool: T[], seed: number, count: number): T[] {
  const indices = Array.from({ length: pool.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = (seed + i * 31) % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).map((i) => pool[i]);
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
    policy.reason === "recency_sensitive"
      ? "Use web search only where current or recent external information materially improves the answer."
      : policy.reason === "source_seeking"
        ? "Use web search only where external sources, papers, datasets, or API references materially improve the answer."
        : "Use web search only where the user explicitly asked for current external information.";

  return [
    basePrompt,
    "External search guidance:",
    `- ${reasonLine}`,
    "- Ground any externally sourced claims in retrieved sources.",
    "- Keep source-backed claims concise so citations can be surfaced cleanly in the response.",
    "- Do not replace the student's project context with generic web information.",
  ].join("\n\n");
}

function detectRoadmapWebSearchPolicy(input: { context: GenerationContext; selectedOption: ProjectOption }): WebSearchPolicy | undefined {
  const combined = [
    input.context.summary,
    input.selectedOption.title,
    input.selectedOption.summary,
    input.selectedOption.why_it_fits,
    JSON.stringify(input.selectedOption.track_payload_json),
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

const SIGNAL_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "be",
  "build",
  "by",
  "can",
  "concrete",
  "defend",
  "deliver",
  "easy",
  "evidence",
  "experience",
  "for",
  "from",
  "goal",
  "goals",
  "in",
  "into",
  "it",
  "its",
  "keep",
  "make",
  "matches",
  "of",
  "on",
  "or",
  "plan",
  "portfolio",
  "project",
  "real",
  "research",
  "ship",
  "student",
  "students",
  "that",
  "the",
  "their",
  "this",
  "to",
  "with",
]);

type ResearchMethodFamily = "survey" | "interview" | "experiment" | "literature" | "secondary_analysis";

type SoftwareFallbackTemplate = {
  artifact: string;
  summary: string;
  why: string;
  target_user: string;
  problem_statement: string;
  core_workflow: string;
  mvp_boundary: string;
  validation_plan: string;
  skills: string[];
  tools: string[];
  impressiveness: number;
  finishability: number;
};

type ResearchFallbackTemplate = {
  title: string;
  summary: string;
  why: string;
  research_question: string;
  hypothesis_or_focus: string;
  methodology: string;
  evidence_plan: string;
  scope_boundaries: string;
  limitation_note: string;
  skills: string[];
  tools: string[];
  impressiveness: number;
  finishability: number;
};

const RESTRICTED_PRIMARY_DATA_PATTERN =
  /\b(public datasets?|public data|published papers?|published sources?|secondary data|literature only|source set|google scholar|no lab access|no interviews?)\b/i;

function normalizeIssueText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function tokenizeSignalText(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .match(/[a-z0-9]+/g)
        ?.filter((token) => {
          if (SIGNAL_STOPWORDS.has(token)) {
            return false;
          }

          return /\d/.test(token) || token.length >= 4;
        }) ?? [],
    ),
  );
}

function hasSignalReference(text: string, signals: string[]) {
  const normalized = text.toLowerCase();
  const textTokens = new Set(tokenizeSignalText(text));

  return signals.some((signal) => {
    const normalizedSignal = normalizeIssueText(signal).toLowerCase();
    if (!normalizedSignal) {
      return false;
    }

    if (normalizedSignal.length >= 18 && normalized.includes(normalizedSignal)) {
      return true;
    }

    const signalTokens = tokenizeSignalText(signal);
    if (signalTokens.length === 0) {
      return false;
    }

    const overlap = signalTokens.filter((token) => textTokens.has(token)).length;
    return overlap >= Math.min(2, signalTokens.length);
  });
}

function getOptionShapeKey(recommendation: ProjectOption) {
  return recommendation.project_track === "research"
    ? `${recommendation.track_payload_json.methodology.toLowerCase()}|${recommendation.track_payload_json.research_question.toLowerCase().slice(0, 80)}`
    : `${recommendation.track_payload_json.target_user.toLowerCase().slice(0, 80)}|${recommendation.track_payload_json.problem_statement.toLowerCase().slice(0, 80)}|${recommendation.track_payload_json.core_workflow.toLowerCase().slice(0, 80)}`;
}

function getConcreteResourceReference(context: GenerationContext) {
  const combined = `${context.track_payload_json.resource_snapshot} ${context.track_payload_json.constraints_summary}`;
  const constrainedPhrase = combined.match(
    /(public datasets?[^.;]*|published papers?[^.;]*|published sources?[^.;]*|secondary data[^.;]*|no lab access[^.;]*|no interviews?[^.;]*|limited[^.;]*|\d+h\/week[^.;]*)/i,
  )?.[0];

  if (constrainedPhrase) {
    return normalizeIssueText(constrainedPhrase.replace(/[.;]+$/g, ""));
  }

  return `${context.track_payload_json.weekly_hours}h/week with ${context.skill_assessment} experience`;
}

function hasRequiredWhyItFitsContextReference(text: string, context: GenerationContext) {
  const goalSignals = [context.track_payload_json.goal_signal, `${context.track_payload_json.target_outcome} goal`];
  const resourceSignals = [
    context.track_payload_json.resource_snapshot,
    context.track_payload_json.constraints_summary,
    getConcreteResourceReference(context),
  ];

  return hasSignalReference(text, goalSignals) || hasSignalReference(text, resourceSignals);
}

export function optionIssues(batch: RecommendationBatch, context: GenerationContext) {
  const anchors = context.track_payload_json.anchor_interests;
  const allowStudentThemes = studentThemesAllowed(JSON.stringify(context));
  const titles = new Set<string>();
  const shapeKeys = new Set<string>();
  const issues: string[] = [];

  batch.recommendations.forEach((recommendation, index) => {
    const content = `${recommendation.title} ${recommendation.summary} ${recommendation.why_it_fits} ${JSON.stringify(recommendation.track_payload_json)}`;
    const shapeKey = getOptionShapeKey(recommendation);

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

    if (!hasRequiredWhyItFitsContextReference(recommendation.why_it_fits, context)) {
      issues.push(`Option ${index + 1} why_it_fits should mention the student's goal or a concrete resource or constraint.`);
    }

    if (recommendation.finishability_score >= 9 && context.risk_flags.some((flag) => flag === "too_little_time" || flag === "too_ambitious")) {
      issues.push(`Option ${index + 1} overstates finishability for the student's constraints.`);
    }

    if (recommendation.skills_demonstrated.length < 2 || recommendation.tools_needed.length < 2) {
      issues.push(`Option ${index + 1} needs more concrete skills/tools detail.`);
    }
  });

  if (new Set(batch.recommendations.map((recommendation) => recommendation.difficulty)).size < 2) {
    issues.push("The batch needs at least two distinct difficulty levels.");
  }

  if (new Set(batch.recommendations.map((recommendation) => recommendation.estimated_weeks)).size < 2) {
    issues.push("The batch needs more timeline differentiation.");
  }

  if (context.project_track === "software") {
    const targetUsers = batch.recommendations
      .filter((r): r is typeof r & { project_track: "software" } => r.project_track === "software")
      .map((r) => r.track_payload_json.target_user.toLowerCase().slice(0, 60));
    if (new Set(targetUsers).size < 2) {
      issues.push("At least two options should target different users or user segments.");
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

  if (issues.length > 0) {
    console.warn("roadmap validation issues", { issues, project_title: roadmap.project_title });
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

function fallbackDifficulty(context: GenerationContext) {
  if (context.skill_assessment === "advanced") {
    return "advanced" as const;
  }

  if (context.skill_assessment === "intermediate") {
    return "intermediate" as const;
  }

  return "beginner" as const;
}

function fallbackDifficultyLadder(context: GenerationContext): ProjectOption["difficulty"][] {
  if (context.skill_assessment === "advanced") {
    return ["intermediate", "advanced", "advanced"];
  }

  if (context.skill_assessment === "intermediate") {
    return ["beginner", "intermediate", "advanced"];
  }

  return ["beginner", "beginner", "intermediate"];
}

function buildEstimatedWeeks(base: number, slotIndex: number) {
  return Math.min(20, base + slotIndex);
}

function repairFallbackTitle(title: string, anchor: string) {
  if (!GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return title;
  }

  const cleaned = title.replace(/^smart\s|^ai[- ]powered\s|^automated\s|^intelligent\s|^universal\s/gi, "").trim();
  return `${anchor} ${cleaned || "Project"}`.trim();
}

function repairWhyItFitsText(original: string, context: GenerationContext, slotIndex: number) {
  const anchor = context.track_payload_json.anchor_interests[slotIndex % context.track_payload_json.anchor_interests.length]
    ?? getPrimaryAnchor(context).toLowerCase();
  const targetOutcome = context.track_payload_json.target_outcome;
  const resourceReference = getConcreteResourceReference(context);
  const base = normalizeIssueText(original).replace(/[.?!]+$/g, "");
  const additions = [
    `It stays grounded in ${anchor}.`,
    `It supports the student's ${targetOutcome} goal.`,
    `It matches ${resourceReference}.`,
  ];

  return normalizeIssueText(`${base}. ${additions.join(" ")}`).slice(0, 360);
}

function classifyResearchMethodFamily(method: string): ResearchMethodFamily {
  const normalized = method.toLowerCase();

  if (/(interview|focus group|thematic analysis|oral history)/.test(normalized)) {
    return "interview";
  }

  if (/(survey|questionnaire)/.test(normalized)) {
    return "survey";
  }

  if (/(experiment|a\/b test|controlled|lab|field experiment|simulation-backed comparison study)/.test(normalized)) {
    return "experiment";
  }

  if (/(literature|review|synthesis|gap analysis)/.test(normalized)) {
    return "literature";
  }

  return "secondary_analysis";
}

function hasPrimaryDataConstraint(context: Extract<GenerationContext, { project_track: "research" }>) {
  if (context.risk_flags.includes("resource_constraint")) {
    return true;
  }

  return RESTRICTED_PRIMARY_DATA_PATTERN.test(
    `${context.track_payload_json.resource_snapshot} ${context.track_payload_json.constraints_summary}`,
  );
}

function getAllowedResearchMethodFamilies(context: Extract<GenerationContext, { project_track: "research" }>) {
  return new Set(context.track_payload_json.viable_methodologies.map((method) => classifyResearchMethodFamily(method)));
}

function requiresPrimaryDataCollection(template: ResearchFallbackTemplate) {
  const normalized = `${template.summary} ${template.evidence_plan} ${template.scope_boundaries}`
    .toLowerCase()
    .replace(/\bno (new )?participant recruitment\b/g, "")
    .replace(/\bno new data collection\b/g, "")
    .replace(/\bno interviews?\b/g, "")
    .replace(/\bno field study\b/g, "");

  return /\b(interview|recruit respondents|recruit participants|collect responses|fieldwork|live questionnaire|new survey responses|conduct 4-6 structured interviews)\b/i.test(
    normalized,
  );
}

function canAddFallbackOption(
  recommendations: ProjectOption[],
  candidate: ProjectOption,
  context: GenerationContext,
  replaceIndex?: number,
) {
  const nextRecommendations = recommendations.filter((_, index) => index !== replaceIndex);
  const lowerTitle = candidate.title.toLowerCase();
  const shapeKey = getOptionShapeKey(candidate);

  if (nextRecommendations.some((recommendation) => recommendation.title.toLowerCase() === lowerTitle)) {
    return false;
  }

  if (nextRecommendations.some((recommendation) => getOptionShapeKey(recommendation) === shapeKey)) {
    return false;
  }

  if (context.project_track === "software" && candidate.project_track === "software") {
    const targetUser = candidate.track_payload_json.target_user.toLowerCase().slice(0, 60);
    if (
      nextRecommendations.some(
        (recommendation) =>
          recommendation.project_track === "software"
          && recommendation.track_payload_json.target_user.toLowerCase().slice(0, 60) === targetUser,
      )
    ) {
      return false;
    }
  }

  return true;
}

function getIssueOptionIndices(issues: string[]) {
  return Array.from(
    new Set(
      issues
        .map((issue) => issue.match(/^Option (\d+)/)?.[1])
        .filter((value): value is string => Boolean(value))
        .map((value) => Number(value) - 1)
        .filter((value) => value >= 0 && value < 3),
    ),
  );
}

function buildOrderedPool<T>(pool: T[], seed: number) {
  return selectFromPool(pool, seed, pool.length);
}

function getSoftwareFallbackTemplates(context: GenerationContext) {
  const primary = getPrimaryAnchor(context);
  const family = getDomainFamilyFromContext(context);

  const hardwarePool: SoftwareFallbackTemplate[] = [
    {
      artifact: "Trace Explorer",
      summary: `Build a focused tool for comparing ${primary.toLowerCase()} tradeoffs with visible benchmark or trace outputs.`,
      why: `This fits because it stays inside ${primary.toLowerCase()} and turns a technical workflow into one clear, demoable product.`,
      target_user: `students or hobbyists exploring ${primary.toLowerCase()} tradeoffs`,
      problem_statement: `Users need a better way to compare ${primary.toLowerCase()} decisions without scattered notes.`,
      core_workflow: "Load a small case set, compare outputs, and review the most important tradeoff in one place.",
      mvp_boundary: `One comparison view for a single ${primary.toLowerCase()} tradeoff with tabular output — no multi-project support, no advanced visualization.`,
      validation_plan: `Demo the tool on one realistic ${primary.toLowerCase()} case set and confirm the comparison output is understandable to a peer.`,
      skills: ["product scoping", "domain translation", "comparative analysis"],
      tools: ["TypeScript", "React", "manual dataset input"],
      impressiveness: 8,
      finishability: 7,
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
      skills: ["debugging workflow design", "quality triage", "UI information architecture"],
      tools: ["TypeScript", "React", "local storage or Supabase"],
      impressiveness: 7,
      finishability: 8,
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
      skills: ["systems thinking", "tradeoff analysis", "technical communication"],
      tools: ["TypeScript", "charts", "manual configuration input"],
      impressiveness: 8,
      finishability: 7,
    },
    {
      artifact: "Config Diff Viewer",
      summary: `Build a tool that highlights meaningful differences between ${primary.toLowerCase()} configurations and explains their impact.`,
      why: `This fits because it makes invisible technical differences visible, which is a strong demo and a useful daily tool.`,
      target_user: `engineers or students reviewing ${primary.toLowerCase()} configuration changes`,
      problem_statement: `Users struggle to spot which ${primary.toLowerCase()} configuration changes actually matter.`,
      core_workflow: "Upload or paste two configurations, diff them, and highlight the changes with impact annotations.",
      mvp_boundary: `Diff two configurations with one annotation layer — no version history, no team sharing.`,
      validation_plan: `Diff 3 pairs of real ${primary.toLowerCase()} configurations and confirm the highlights match expert judgment.`,
      skills: ["diff algorithm design", "technical communication", "domain-specific annotation"],
      tools: ["TypeScript", "React", "diff library"],
      impressiveness: 7,
      finishability: 9,
    },
    {
      artifact: "Constraint Checker",
      summary: `Create a lightweight validator that catches common ${primary.toLowerCase()} constraint violations before they become expensive bugs.`,
      why: `This fits because it produces immediate, visible value — catch a mistake before it costs hours of debugging.`,
      target_user: `students or engineers building ${primary.toLowerCase()} projects`,
      problem_statement: `Common ${primary.toLowerCase()} constraint violations are easy to miss during manual review.`,
      core_workflow: "Input a specification or configuration, run constraint checks, and surface violations with explanations.",
      mvp_boundary: `Check one specification type against 5-10 common constraints — no auto-fix, no CI integration.`,
      validation_plan: `Run the checker on 3 real ${primary.toLowerCase()} specs with known violations and confirm all are caught.`,
      skills: ["validation logic", "error reporting UX", "domain constraint modeling"],
      tools: ["TypeScript", "React", "rule engine"],
      impressiveness: 8,
      finishability: 8,
    },
  ];

  const generalPool: SoftwareFallbackTemplate[] = [
    {
      artifact: "Workflow Analyzer",
      summary: `Build a focused product that improves one recurring ${primary.toLowerCase()} workflow with a visible output.`,
      why: `This fits because it stays tied to the student's real interests and keeps the MVP centered on one useful action.`,
      target_user: `people working on recurring ${primary.toLowerCase()} tasks`,
      problem_statement: `Users need a better way to handle one common ${primary.toLowerCase()} workflow without manual glue work.`,
      core_workflow: "Capture a key input, run one core flow, and return one useful domain-specific output.",
      mvp_boundary: `One input type, one analysis flow, one output format — no batch processing, no multi-workflow support.`,
      validation_plan: `Run the tool on 3 realistic ${primary.toLowerCase()} inputs and confirm the output saves time compared to the manual process.`,
      skills: ["workflow modeling", "product scoping", "domain-specific UX"],
      tools: ["TypeScript", "React", "manual test cases"],
      impressiveness: 7,
      finishability: 8,
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
      skills: ["decision framework design", "comparative UX", "transparent scoring"],
      tools: ["TypeScript", "React", "lightweight scoring logic"],
      impressiveness: 7,
      finishability: 9,
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
      skills: ["scenario comparison", "information design", "domain communication"],
      tools: ["TypeScript", "React", "simple charting"],
      impressiveness: 8,
      finishability: 8,
    },
    {
      artifact: "Input Validator",
      summary: `Build a focused checker that catches common ${primary.toLowerCase()} mistakes before they propagate through a workflow.`,
      why: `This fits because it delivers immediate, tangible value — preventing errors the student has likely encountered firsthand.`,
      target_user: `beginners or intermediate practitioners in ${primary.toLowerCase()}`,
      problem_statement: `Common ${primary.toLowerCase()} input errors are tedious to catch manually and often surface too late.`,
      core_workflow: "Paste or upload an input, run validation rules, and see a clear report of issues with fix suggestions.",
      mvp_boundary: `Validate one input type against 5-10 rules — no auto-fix, no batch processing.`,
      validation_plan: `Run the validator on 5 realistic ${primary.toLowerCase()} inputs with known errors and confirm all are caught.`,
      skills: ["validation logic design", "error communication", "domain modeling"],
      tools: ["TypeScript", "React", "rule engine"],
      impressiveness: 7,
      finishability: 9,
    },
    {
      artifact: "Progress Tracker",
      summary: `Create a lightweight dashboard that visualizes progress through a multi-step ${primary.toLowerCase()} process.`,
      why: `This fits because it solves a real frustration — losing track of where you are in a complex ${primary.toLowerCase()} workflow.`,
      target_user: `students or self-directed learners working through ${primary.toLowerCase()} projects`,
      problem_statement: `Users lose track of progress and next steps when working through multi-step ${primary.toLowerCase()} processes.`,
      core_workflow: "Define steps, mark progress, and see a visual summary of what is done and what remains.",
      mvp_boundary: `Track one project with up to 10 steps — no collaboration, no notifications.`,
      validation_plan: `Track a real ${primary.toLowerCase()} project through at least 3 steps and confirm the progress view is accurate and motivating.`,
      skills: ["state management", "progress visualization", "user motivation design"],
      tools: ["TypeScript", "React", "local storage"],
      impressiveness: 6,
      finishability: 9,
    },
  ];

  const conservativePool: SoftwareFallbackTemplate[] = [
    {
      artifact: "Review Console",
      summary: `Build a narrow review surface that helps people inspect one recurring ${primary.toLowerCase()} workflow with clearer outputs.`,
      why: `This fits because it keeps the scope tight while giving the student a domain-grounded artifact they can demo and defend.`,
      target_user: `students reviewing ${primary.toLowerCase()} work`,
      problem_statement: `Users need a clearer way to inspect one ${primary.toLowerCase()} workflow without juggling scattered notes.`,
      core_workflow: "Load one case, review the result, and record the next action in one place.",
      mvp_boundary: `One review flow for one ${primary.toLowerCase()} case type with a compact notes panel.`,
      validation_plan: `Run the console on 3 realistic ${primary.toLowerCase()} cases and confirm the review flow stays clear.`,
      skills: ["review workflow design", "information clarity", "product scoping"],
      tools: ["TypeScript", "React", "manual case set"],
      impressiveness: 7,
      finishability: 8,
    },
    {
      artifact: "Decision Workbook",
      summary: `Create a structured decision helper for one recurring ${primary.toLowerCase()} choice with a transparent scoring flow.`,
      why: `This fits because it connects the student's interests to a clear, explainable product with visible reasoning.`,
      target_user: `practitioners comparing ${primary.toLowerCase()} options`,
      problem_statement: `Users need a more transparent way to compare a few ${primary.toLowerCase()} options without ad hoc scoring.`,
      core_workflow: "Enter options, score them with one rubric, and review the recommendation with supporting notes.",
      mvp_boundary: `One scoring rubric for up to 5 options with no saved projects or sharing features.`,
      validation_plan: `Score 3 realistic ${primary.toLowerCase()} options and confirm the recommendation is understandable.`,
      skills: ["decision modeling", "transparent scoring", "domain communication"],
      tools: ["TypeScript", "React", "lightweight scoring logic"],
      impressiveness: 7,
      finishability: 9,
    },
    {
      artifact: "Input Checker",
      summary: `Build a focused checker that catches common ${primary.toLowerCase()} mistakes before they slow down the rest of the workflow.`,
      why: `This fits because it delivers visible value quickly while staying grounded in a real domain pain point.`,
      target_user: `beginners working with ${primary.toLowerCase()} inputs`,
      problem_statement: `Common ${primary.toLowerCase()} input mistakes are hard to catch manually and waste time later in the workflow.`,
      core_workflow: "Paste one input, run the checks, and review a short list of issues with next-step guidance.",
      mvp_boundary: `Validate one input type against a small ruleset with no auto-fix or batch mode.`,
      validation_plan: `Run the checker on 5 realistic ${primary.toLowerCase()} inputs with known issues and confirm the report is accurate.`,
      skills: ["validation logic", "error communication", "domain modeling"],
      tools: ["TypeScript", "React", "rule engine"],
      impressiveness: 7,
      finishability: 9,
    },
  ];

  return {
    ordered: buildOrderedPool(family === "hardware" ? hardwarePool : generalPool, contextSeed(context)),
    conservative: conservativePool,
  };
}

function getResearchFallbackTemplates(context: Extract<GenerationContext, { project_track: "research" }>) {
  const primary = getPrimaryAnchor(context);

  const pool: ResearchFallbackTemplate[] = [
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
      skills: ["question formulation", "evidence framing", "data interpretation"],
      tools: ["spreadsheet or notebook", "public dataset", "citation manager"],
      impressiveness: 8,
      finishability: 8,
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
      skills: ["literature synthesis", "comparative reasoning", "research writing"],
      tools: ["Google Scholar", "shared notes", "comparison matrix"],
      impressiveness: 7,
      finishability: 9,
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
      skills: ["evaluation framework design", "case-based analysis", "limitations framing"],
      tools: ["spreadsheet", "curated case set", "writing doc"],
      impressiveness: 8,
      finishability: 8,
    },
    {
      title: `Mapping the evidence gaps in ${primary}`,
      summary: `Conduct a focused gap analysis of existing ${primary.toLowerCase()} literature to identify what questions remain unanswered.`,
      why: `This fits because a gap analysis is inherently original — the student produces a unique contribution by synthesizing what exists and naming what is missing.`,
      research_question: `What are the most significant evidence gaps in current ${primary.toLowerCase()} research?`,
      hypothesis_or_focus: `Existing ${primary.toLowerCase()} literature clusters around well-studied questions while leaving practical sub-questions under-examined.`,
      methodology: "structured literature gap analysis",
      evidence_plan: `Systematically review 15-25 recent ${primary.toLowerCase()} sources and categorize them by question addressed.`,
      scope_boundaries: `Review one sub-area of ${primary.toLowerCase()} using one database — no exhaustive systematic review.`,
      limitation_note: `Gap analysis is limited to sources available in the chosen database and publication window.`,
      skills: ["literature mapping", "gap identification", "synthesis writing"],
      tools: ["Google Scholar", "categorization spreadsheet", "writing doc"],
      impressiveness: 7,
      finishability: 9,
    },
    {
      title: `How practitioners actually make ${primary} decisions`,
      summary: `Interview or survey a small group of ${primary.toLowerCase()} practitioners to understand how real-world decisions diverge from published best practices.`,
      why: `This fits because primary data collection — even at small scale — demonstrates research initiative and produces genuinely original findings.`,
      research_question: `How do ${primary.toLowerCase()} practitioners make decisions in practice, and where do they diverge from published guidance?`,
      hypothesis_or_focus: `Practitioners in ${primary.toLowerCase()} rely on heuristics and context-specific factors that published best practices do not capture.`,
      methodology: "structured interviews with thematic analysis",
      evidence_plan: `Conduct 4-6 structured interviews with ${primary.toLowerCase()} practitioners and code responses for themes.`,
      scope_boundaries: `4-6 interviews within one practitioner group — no cross-group comparison, no longitudinal follow-up.`,
      limitation_note: `Small sample size limits generalizability; findings reflect one practitioner group's perspective.`,
      skills: ["interview design", "qualitative coding", "thematic analysis"],
      tools: ["interview guide", "recording tool", "coding spreadsheet"],
      impressiveness: 8,
      finishability: 7,
    },
  ];

  const conservativePool: ResearchFallbackTemplate[] = [
    {
      title: `Survey signals behind ${primary} choices`,
      summary: `Use published questionnaire results or validated survey instruments to study one concrete decision pattern in ${primary.toLowerCase()} with simple descriptive analysis.`,
      why: `This fits because it keeps the evidence path accessible while still producing a defensible, survey-shaped research artifact.`,
      research_question: `Which factors most influence routine ${primary.toLowerCase()} choices in published or validated survey evidence?`,
      hypothesis_or_focus: `Published questionnaire evidence can reveal a small set of recurring factors that shape ${primary.toLowerCase()} decisions.`,
      methodology: "focused survey with structured instrument",
      evidence_plan: `Use one published survey dataset or validated questionnaire in ${primary.toLowerCase()} and summarize the response patterns with simple counts.`,
      scope_boundaries: `One survey source, one audience segment, and one decision context with no new participant recruitment or interviews.`,
      limitation_note: `The findings are limited to one published or validated survey source and should be interpreted as exploratory.`,
      skills: ["survey design", "descriptive analysis", "limitations framing"],
      tools: ["survey instrument library", "spreadsheet", "writing doc"],
      impressiveness: 7,
      finishability: 8,
    },
    {
      title: `Questionnaire patterns already visible in ${primary}`,
      summary: `Compare one or two published questionnaire sources in ${primary.toLowerCase()} to show which survey signals stay consistent.`,
      why: `This fits because it uses survey-style reasoning without assuming the student can recruit respondents from scratch.`,
      research_question: `Which survey patterns remain most consistent across existing ${primary.toLowerCase()} questionnaire sources?`,
      hypothesis_or_focus: `A small group of survey indicators in ${primary.toLowerCase()} remain stable across existing questionnaire sources.`,
      methodology: "questionnaire with lightweight secondary analysis",
      evidence_plan: `Use one or two existing questionnaire sources tied to ${primary.toLowerCase()} and compare the most relevant response patterns.`,
      scope_boundaries: `Two published questionnaire sources at most with no new data collection or interviews.`,
      limitation_note: `The comparison is limited to the wording and sampling choices of the selected questionnaire sources.`,
      skills: ["questionnaire analysis", "comparative reasoning", "scope control"],
      tools: ["published questionnaire source", "spreadsheet", "writing doc"],
      impressiveness: 7,
      finishability: 8,
    },
    {
      title: `Designing a stronger survey lens for ${primary}`,
      summary: `Evaluate how existing survey instruments in ${primary.toLowerCase()} frame one practical question and propose a tighter instrument design.`,
      why: `This fits because it stays survey-based while remaining realistic for a student working from published instruments and public evidence.`,
      research_question: `How well do current survey instruments capture one practical ${primary.toLowerCase()} question, and what should change?`,
      hypothesis_or_focus: `Existing survey instruments in ${primary.toLowerCase()} miss one practical factor that a tighter questionnaire design could capture.`,
      methodology: "focused survey with structured instrument",
      evidence_plan: `Review a small set of published survey instruments in ${primary.toLowerCase()} and compare how each measures the same practical factor.`,
      scope_boundaries: `Three published instruments at most with no new deployment, interviews, or validation study.`,
      limitation_note: `The instrument critique is limited to published wording and does not test new survey performance.`,
      skills: ["survey instrument review", "measurement critique", "research writing"],
      tools: ["published survey instruments", "comparison matrix", "writing doc"],
      impressiveness: 7,
      finishability: 8,
    },
    {
      title: `What public data already reveals about ${primary}`,
      summary: `Analyze one accessible source set to answer a narrow question in ${primary.toLowerCase()} without requiring new data collection.`,
      why: `This fits because it keeps access realistic while giving the student a concrete, evidence-based question to answer.`,
      research_question: `What pattern in public ${primary.toLowerCase()} data most strongly explains one meaningful outcome?`,
      hypothesis_or_focus: `One measurable factor in accessible ${primary.toLowerCase()} data explains more variation than common intuition suggests.`,
      methodology: "secondary data analysis",
      evidence_plan: `Use one public dataset or source set tied to ${primary.toLowerCase()} and analyze a single outcome relationship.`,
      scope_boundaries: `One dataset, one relationship, and one outcome measure with no new participant data.`,
      limitation_note: `The findings are limited to one accessible source set and do not establish causality.`,
      skills: ["data framing", "evidence interpretation", "scope control"],
      tools: ["spreadsheet or notebook", "public dataset", "citation manager"],
      impressiveness: 8,
      finishability: 8,
    },
    {
      title: `A small simulation experiment for ${primary}`,
      summary: `Run a tightly scoped simulation or controlled comparison in ${primary.toLowerCase()} without needing participant recruitment or lab access.`,
      why: `This fits because it keeps the experiment family available while staying realistic for limited-access student work.`,
      research_question: `What changes when one controllable factor in ${primary.toLowerCase()} is varied inside a small simulation or benchmark setup?`,
      hypothesis_or_focus: `One controllable factor in ${primary.toLowerCase()} creates a measurable difference inside a small simulation or benchmark setup.`,
      methodology: "simulation-backed comparison study",
      evidence_plan: `Use one simple simulation, benchmark, or controlled output comparison tied to ${primary.toLowerCase()} and vary a single factor.`,
      scope_boundaries: `One factor, one simulation or benchmark setup, and one output measure with no participant recruitment or field study.`,
      limitation_note: `The findings are limited to a simplified simulation or benchmark setup and may not generalize to full real-world conditions.`,
      skills: ["experimental framing", "controlled comparison", "results interpretation"],
      tools: ["simulation or benchmark setup", "spreadsheet or notebook", "writing doc"],
      impressiveness: 8,
      finishability: 8,
    },
    {
      title: `Controlled comparison of ${primary} strategies`,
      summary: `Design a small controlled comparison in ${primary.toLowerCase()} that tests one factor at a time using accessible materials or model outputs.`,
      why: `This fits because it preserves a real experiment shape without assuming special facilities or participant access.`,
      research_question: `Which of two narrow ${primary.toLowerCase()} strategies performs better when one factor is controlled at a time?`,
      hypothesis_or_focus: `One narrow ${primary.toLowerCase()} strategy consistently performs better than another under a controlled setup.`,
      methodology: "small controlled experiment",
      evidence_plan: `Use a small controlled setup, benchmark, or model-output comparison in ${primary.toLowerCase()} and record one output metric across repeated runs.`,
      scope_boundaries: `Two strategies, one controlled setup, and one metric with no participant recruitment or large-scale testing.`,
      limitation_note: `The controlled comparison is limited to a simplified setup and should be read as exploratory rather than definitive.`,
      skills: ["experimental control", "comparison design", "results framing"],
      tools: ["benchmark or controlled setup", "spreadsheet", "writing doc"],
      impressiveness: 8,
      finishability: 8,
    },
    {
      title: `A/B-style output test for ${primary}`,
      summary: `Use a small A/B-style comparison on accessible materials in ${primary.toLowerCase()} to evaluate one narrow intervention.`,
      why: `This fits because it gives the student an experiment-shaped project that still respects realistic access limits.`,
      research_question: `Does one narrow intervention improve a specific ${primary.toLowerCase()} outcome inside an A/B-style comparison?`,
      hypothesis_or_focus: `A small intervention in ${primary.toLowerCase()} improves one specific outcome inside an A/B-style comparison.`,
      methodology: "small A/B test on model outputs",
      evidence_plan: `Prepare one A/B-style comparison using accessible outputs, texts, or benchmark materials tied to ${primary.toLowerCase()} and score one outcome difference.`,
      scope_boundaries: `One intervention, one output comparison, and one scoring rule with no live participant recruitment.`,
      limitation_note: `The A/B-style comparison reflects a narrow setup and should not be interpreted as a broad causal claim.`,
      skills: ["A/B comparison design", "evaluation framing", "scope control"],
      tools: ["comparison rubric", "accessible output set", "spreadsheet"],
      impressiveness: 7,
      finishability: 8,
    },
    {
      title: `Where the literature still disagrees on ${primary}`,
      summary: `Synthesize a small, recent source set in ${primary.toLowerCase()} to show where evidence converges, diverges, or stays incomplete.`,
      why: `This fits because it produces a polished, defensible artifact without depending on special access or primary data collection.`,
      research_question: `Where does recent ${primary.toLowerCase()} literature agree, and where do the strongest disagreements remain?`,
      hypothesis_or_focus: `Recent ${primary.toLowerCase()} sources converge on a few core patterns while leaving one practical disagreement unresolved.`,
      methodology: "structured literature synthesis",
      evidence_plan: `Review a focused set of recent ${primary.toLowerCase()} papers and organize them by agreement, disagreement, and missing evidence.`,
      scope_boundaries: `One sub-question, one source window, and one synthesis matrix with no exhaustive review claims.`,
      limitation_note: `The synthesis is limited to the selected source window and does not claim exhaustive coverage.`,
      skills: ["literature synthesis", "evidence comparison", "research writing"],
      tools: ["Google Scholar", "source matrix", "writing doc"],
      impressiveness: 7,
      finishability: 9,
    },
  ];

  return {
    ordered: buildOrderedPool(pool, contextSeed(context)),
    conservative: conservativePool,
  };
}

function buildSoftwareFallbackOption(
  context: GenerationContext,
  template: SoftwareFallbackTemplate,
  slotIndex: number,
): Extract<ProjectOption, { project_track: "software" }> {
  const baseWeeks = estimateWeeksFromContext(context);
  const difficulty = fallbackDifficultyLadder(context)[slotIndex] ?? fallbackDifficulty(context);
  const title = repairFallbackTitle(`${getPrimaryAnchor(context)} ${template.artifact}`, getPrimaryAnchor(context));

  return {
    id: `${slugify(getPrimaryAnchor(context))}-${slugify(template.artifact)}-${slotIndex + 1}`,
    project_track: "software",
    title,
    summary: template.summary,
    why_it_fits: repairWhyItFitsText(template.why, context, slotIndex),
    difficulty,
    estimated_weeks: buildEstimatedWeeks(baseWeeks, slotIndex),
    skills_demonstrated: template.skills,
    tools_needed: template.tools,
    impressiveness_score: template.impressiveness,
    finishability_score: template.finishability,
    track_payload_json: {
      target_user: template.target_user,
      problem_statement: template.problem_statement,
      core_workflow: template.core_workflow,
      mvp_boundary: template.mvp_boundary,
      validation_plan: template.validation_plan,
    },
  };
}

function buildResearchFallbackOption(
  context: Extract<GenerationContext, { project_track: "research" }>,
  template: ResearchFallbackTemplate,
  slotIndex: number,
): Extract<ProjectOption, { project_track: "research" }> {
  const baseWeeks = estimateWeeksFromContext(context) + 1;
  const difficulty = fallbackDifficultyLadder(context)[slotIndex] ?? fallbackDifficulty(context);
  const title = repairFallbackTitle(template.title, getPrimaryAnchor(context));

  return {
    id: `${slugify(getPrimaryAnchor(context))}-research-${slugify(title)}-${slotIndex + 1}`,
    project_track: "research",
    title,
    summary: template.summary,
    why_it_fits: repairWhyItFitsText(template.why, context, slotIndex),
    difficulty,
    estimated_weeks: buildEstimatedWeeks(baseWeeks, slotIndex),
    skills_demonstrated: template.skills,
    tools_needed: template.tools,
    impressiveness_score: template.impressiveness,
    finishability_score: template.finishability,
    track_payload_json: {
      research_question: template.research_question,
      hypothesis_or_focus: template.hypothesis_or_focus,
      methodology: template.methodology,
      evidence_plan: template.evidence_plan,
      scope_boundaries: template.scope_boundaries,
      limitation_note: template.limitation_note,
    },
  };
}

function isResearchTemplateFeasible(
  template: ResearchFallbackTemplate,
  context: Extract<GenerationContext, { project_track: "research" }>,
) {
  const family = classifyResearchMethodFamily(template.methodology);
  const allowedFamilies = getAllowedResearchMethodFamilies(context);

  if (!allowedFamilies.has(family)) {
    return false;
  }

  if (hasPrimaryDataConstraint(context) && requiresPrimaryDataCollection(template)) {
    return false;
  }

  return true;
}

function nextFallbackReplacement(
  remaining: ProjectOption[],
  recommendations: ProjectOption[],
  context: GenerationContext,
  replaceIndex: number,
) {
  while (remaining.length > 0) {
    const next = remaining.shift();
    if (!next) {
      break;
    }

    if (canAddFallbackOption(recommendations, next, context, replaceIndex)) {
      return next;
    }
  }

  return null;
}

function assembleFallbackBatch(candidates: ProjectOption[], context: GenerationContext) {
  const remaining = [...candidates];
  const selected: ProjectOption[] = [];

  while (selected.length < 3 && remaining.length > 0) {
    const candidate = remaining.shift();
    if (!candidate) {
      break;
    }

    if (canAddFallbackOption(selected, candidate, context)) {
      selected.push(candidate);
    }
  }

  if (selected.length < 3) {
    throw new Error("Deterministic fallback pool exhausted before a safe batch could be assembled.");
  }

  let guard = 0;
  while (guard < candidates.length + 3) {
    const batch = RecommendationBatchSchema.parse({ recommendations: selected });
    const issues = optionIssues(batch, context);
    if (issues.length === 0) {
      return batch;
    }

    const failingIndices = getIssueOptionIndices(issues);
    let changed = false;

    for (const index of failingIndices) {
      const repaired = {
        ...selected[index],
        title: repairFallbackTitle(selected[index].title, getPrimaryAnchor(context)),
        why_it_fits: repairWhyItFitsText(selected[index].why_it_fits, context, index),
      } as ProjectOption;
      selected[index] = repaired;
      changed = true;
    }

    const repairedBatch = RecommendationBatchSchema.parse({ recommendations: selected });
    const repairedIssues = optionIssues(repairedBatch, context);
    if (repairedIssues.length === 0) {
      return repairedBatch;
    }

    for (const index of getIssueOptionIndices(repairedIssues)) {
      const replacement = nextFallbackReplacement(remaining, selected, context, index);
      if (replacement) {
        selected[index] = replacement;
        changed = true;
      }
    }

    if (!changed) {
      break;
    }

    guard += 1;
  }

  return RecommendationBatchSchema.parse({ recommendations: selected });
}

export function buildDeterministicFallbackOptions(context: GenerationContext): RecommendationBatch {
  if (context.project_track === "research") {
    const { ordered, conservative } = getResearchFallbackTemplates(context);
    const candidates = [
      ...ordered.filter((template) => isResearchTemplateFeasible(template, context)),
      ...conservative.filter((template) => isResearchTemplateFeasible(template, context)),
    ].map((template, index) => buildResearchFallbackOption(context, template, index % 3));

    return assembleFallbackBatch(candidates, context);
  }

  const { ordered, conservative } = getSoftwareFallbackTemplates(context);
  const candidates = [...ordered, ...conservative].map((template, index) => buildSoftwareFallbackOption(context, template, index % 3));
  return assembleFallbackBatch(candidates, context);
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
  const seed = contextSeed(context);
  const brief = `This project builds a ${selectedOption.title.toLowerCase()} for ${payload.target_user.toLowerCase()}. The core problem is that ${payload.problem_statement.toLowerCase()}. The MVP centers on ${payload.core_workflow.toLowerCase()} within the boundary of ${payload.mvp_boundary.toLowerCase()}. The student will validate success by ${payload.validation_plan.toLowerCase()}, working ${context.track_payload_json.weekly_hours} hours per week over ${selectedOption.estimated_weeks} weeks.`;

  const stepTemplates = [
    // Template A: Scope → Data → Workflow → Validation → Polish
    [
      {
        title: `Lock the ${selectedOption.title} scope`,
        objective: "Define the user, problem, workflow, and exact MVP boundary before building features.",
        deliverable: "Product scope brief with success rubric",
        rough_time_estimate: "3-4 days",
        validation_check: "The scope brief names the target user, core workflow, MVP boundary, and at least 2 success criteria.",
        scope_guardrail: "Do not start building until the scope brief is written and reviewed.",
      },
      {
        title: `Set up the ${selectedOption.title} data model`,
        objective: "Build the smallest data model and input flow needed for the first usable version of the product.",
        deliverable: "Working schema and input path",
        rough_time_estimate: "1 week",
        validation_check: "The input path accepts realistic data and the schema stores it correctly.",
        scope_guardrail: "Only model data needed for the core workflow — no optional fields or future-proofing.",
      },
      {
        title: `Build the ${payload.core_workflow.toLowerCase().slice(0, 50)} flow`,
        objective: "Implement the end-to-end flow that turns real inputs into the product's useful output.",
        deliverable: "Usable MVP workflow",
        rough_time_estimate: "1-2 weeks",
        validation_check: "A realistic input produces the expected output through the complete workflow.",
        scope_guardrail: "Ship the happy path first — handle edge cases only after the main flow works.",
      },
      {
        title: `Validate with real ${payload.target_user.toLowerCase().slice(0, 40)} inputs`,
        objective: "Make the output understandable and test it on realistic examples from the domain.",
        deliverable: "Validation-ready review screen or report",
        rough_time_estimate: "1 week",
        validation_check: "At least 3 realistic examples produce correct, understandable output.",
        scope_guardrail: "Test with real domain data — do not build elaborate error handling before the happy path is validated.",
      },
      {
        title: `Ship the ${selectedOption.title} demo`,
        objective: "Tighten the final user path, fix rough edges, and prepare a clear demo or walkthrough.",
        deliverable: "Demo-ready build and walkthrough notes",
        rough_time_estimate: "4-5 days",
        validation_check: "Someone unfamiliar with the project can follow the demo path and understand the product's value.",
        scope_guardrail: "Polish only the demo path — do not add features or fix non-critical bugs.",
      },
    ],
    // Template B: Prototype-first → User test → Rebuild → Integrate → Package
    [
      {
        title: `Sketch the ${selectedOption.title} prototype`,
        objective: "Build the fastest possible version that demonstrates the core value proposition — even if it is ugly or fragile.",
        deliverable: "Working prototype that completes the core workflow once",
        rough_time_estimate: "4-5 days",
        validation_check: "The prototype can run one realistic input through the core flow and produce a visible output.",
        scope_guardrail: "Use hardcoded values and shortcuts freely — the goal is speed, not quality.",
      },
      {
        title: `Test the prototype on a real ${payload.target_user.toLowerCase().slice(0, 40)} scenario`,
        objective: "Run the prototype on 2-3 realistic inputs and document what works, what breaks, and what is confusing.",
        deliverable: "Test log with issues list and priority ranking",
        rough_time_estimate: "3-4 days",
        validation_check: "The test log has at least 3 tested scenarios with documented outcomes and a ranked issue list.",
        scope_guardrail: "Do not fix issues during testing — just document them.",
      },
      {
        title: `Rebuild the ${payload.core_workflow.toLowerCase().slice(0, 50)} properly`,
        objective: "Replace the prototype's shortcuts with a reliable implementation that handles the issues found during testing.",
        deliverable: "Production-quality core workflow",
        rough_time_estimate: "1-2 weeks",
        validation_check: "All priority issues from the test log are resolved and the workflow handles edge cases from testing.",
        scope_guardrail: "Only fix issues discovered during testing — do not add new features.",
      },
      {
        title: `Add the output and review layer`,
        objective: "Make the output understandable and useful without explanation — add labels, summaries, or visual cues.",
        deliverable: "Self-explanatory output view",
        rough_time_estimate: "1 week",
        validation_check: "A new user can understand the output without a walkthrough.",
        scope_guardrail: "Focus on clarity of existing output — do not add new output types.",
      },
      {
        title: `Package ${selectedOption.title} for demo`,
        objective: "Prepare the final demo path and document what was built and why.",
        deliverable: "Demo-ready build and brief write-up",
        rough_time_estimate: "4-5 days",
        validation_check: "Someone unfamiliar with the project can follow the demo and explain what it does.",
        scope_guardrail: "Package what exists — do not add features.",
      },
    ],
    // Template C: Vertical slice → Expand → Harden → Edge cases → Package
    [
      {
        title: `Build one end-to-end slice of ${selectedOption.title}`,
        objective: "Implement the thinnest possible version that goes from raw input to useful output for one specific case.",
        deliverable: "Working vertical slice for one case",
        rough_time_estimate: "1 week",
        validation_check: "One realistic input goes through the entire pipeline and produces a correct, visible output.",
        scope_guardrail: "Support exactly one input type and one output format — nothing more.",
      },
      {
        title: `Expand the ${payload.core_workflow.toLowerCase().slice(0, 50)} to handle real variety`,
        objective: "Generalize the vertical slice to handle 3-5 different realistic inputs without breaking.",
        deliverable: "Expanded workflow passing on varied inputs",
        rough_time_estimate: "1 week",
        validation_check: "At least 3 different realistic inputs produce correct outputs through the full workflow.",
        scope_guardrail: "Add variety in inputs, not features — the workflow shape should not change.",
      },
      {
        title: `Harden the ${selectedOption.title} happy path`,
        objective: "Fix the rough edges, error states, and confusing outputs that emerge with varied inputs.",
        deliverable: "Stable happy path with clear error messages",
        rough_time_estimate: "1 week",
        validation_check: "All 5 test inputs produce correct or clearly-explained outputs with no silent failures.",
        scope_guardrail: "Only handle errors that users will actually hit on the happy path.",
      },
      {
        title: `Add the review and comparison view`,
        objective: "Let the user see, compare, or evaluate the outputs in a way that makes the tool's value obvious.",
        deliverable: "Review or comparison screen",
        rough_time_estimate: "4-5 days",
        validation_check: "A user can compare at least 2 outputs and understand which is better and why.",
        scope_guardrail: "Build one comparison view — do not add filters, exports, or sharing.",
      },
      {
        title: `Demo-ready ${selectedOption.title}`,
        objective: "Polish the demo path and prepare a brief that explains the project's value.",
        deliverable: "Demo walkthrough and project brief",
        rough_time_estimate: "3-4 days",
        validation_check: "A peer can follow the demo and summarize what the project does without help.",
        scope_guardrail: "Polish only — no new features.",
      },
    ],
  ];

  const steps = stepTemplates[seed % stepTemplates.length].map((step, index) => ({
    ...step,
    order_index: index,
  }));

  return RoadmapOverviewSchema.parse({
    project_title: selectedOption.title,
    short_overview: `${selectedOption.title} is a focused software roadmap built around ${payload.problem_statement.toLowerCase()} and a narrow MVP.`,
    project_brief: brief,
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
    steps,
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

export async function runProfileNormalization(input: {
  projectTrack: ProjectTrack;
  rawIntake: Record<string, unknown>;
  feedback?: PromptFeedbackItem[];
}): Promise<PipelineResult<GenerationContext>> {
  try {
    const result = await generateStructuredOutput({
      stage: "normalize",
      schema: input.projectTrack === "research" ? ResearchGenerationContextSchema : SoftwareGenerationContextSchema,
      schemaName: `${input.projectTrack}_normalized_context`,
      systemPrompt: buildNormalizeSystemPrompt(input.projectTrack),
      userPrompt: buildNormalizeUserPrompt(input),
      validator: (parsed) => normalizedContextIssues(parsed),
    });

    return {
      parsed: result.parsed,
      raw: result.raw,
      metrics: result.metrics,
      citations: result.citations,
      refusal: result.refusal,
    };
  } catch (error) {
    console.warn("normalize generation failed, using deterministic context", { error: error instanceof Error ? error.message : error });
    const parsed = buildGenerationContext({
      projectTrack: input.projectTrack,
      rawIntake: input.rawIntake,
    });
    const metrics = getFailureMetrics(error, "normalize");

    return {
      parsed,
      raw: {
        source: "fallback",
        stage: "normalize",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      metrics: { ...metrics, fallback_used: true },
      citations: [],
      refusal: null,
    };
  }
}

export async function runOptionsGeneration(
  context: GenerationContext,
  feedback?: PromptFeedbackItem[],
): Promise<PipelineResult<RecommendationBatch>> {
  try {
    const result = await generateStructuredOutput({
      stage: "options",
      schema: RecommendationBatchSchema,
      schemaName: `${context.project_track}_options`,
      systemPrompt: buildOptionsSystemPrompt(context.project_track),
      userPrompt: buildOptionsUserPrompt(context, feedback),
      validator: (parsed) => optionIssues(parsed, context),
    });

    return {
      parsed: result.parsed,
      raw: result.raw,
      metrics: result.metrics,
      citations: result.citations,
      refusal: result.refusal,
    };
  } catch (error) {
    console.warn("options generation failed, using fallback", { error: error instanceof Error ? error.message : error });
    const parsed = buildDeterministicFallbackOptions(context);
    const metrics = getFailureMetrics(error, "options");

    return {
      parsed,
      raw: {
        source: "fallback",
        stage: "options",
        reason: error instanceof Error ? error.message : "Unknown error",
      },
      metrics: { ...metrics, fallback_used: true },
      citations: [],
      refusal: null,
    };
  }
}

export async function runRoadmapGeneration(input: {
  context: GenerationContext;
  selectedOption: ProjectOption;
  feedback?: PromptFeedbackItem[];
}): Promise<PipelineResult<RoadmapOverview>> {
  try {
    const webSearch = detectRoadmapWebSearchPolicy(input);
    const result = await generateStructuredOutput({
      stage: "roadmap",
      schema: RoadmapOverviewSchema,
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
      webSearch,
    });

    return {
      parsed: normalizeRoadmapSteps(result.parsed),
      raw: result.raw,
      metrics: result.metrics,
      citations: result.citations,
      refusal: result.refusal,
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
      citations: [],
      refusal: null,
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
  feedback?: PromptFeedbackItem[];
}): Promise<PipelineResult<StepGuidance>> {
  try {
    const webSearch = detectStepGuidanceWebSearchPolicy(input);
    const result = await generateStructuredOutput({
      stage: "step_guidance",
      schema: StepGuidanceSchema,
      schemaName: `${input.context.project_track}_step_guidance`,
      systemPrompt: buildStepGuidanceSystemPrompt(input.context.project_track, input.step.order_index, input.roadmap.steps.length),
      userPrompt: appendExternalSearchGuidance(buildStepGuidanceUserPrompt(input), webSearch),
      validator: (parsed) => stepGuidanceIssues(parsed, input.step, input.context),
      webSearch,
    });

    return {
      parsed: result.parsed,
      raw: result.raw,
      metrics: result.metrics,
      citations: result.citations,
      refusal: result.refusal,
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
      citations: [],
      refusal: null,
    };
  }
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
