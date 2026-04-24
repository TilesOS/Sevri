import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { z } from "zod";
import { getAIEnv } from "@/lib/env";
import {
  applyStructuredCleanup,
  buildRepairFeedback,
  checkStructured,
  type ContentQualityReport,
  type FieldSpecMap,
  type QualityIssueKind,
} from "@/lib/ai/content-quality";

const env = getAIEnv();
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type GenerationStage =
  | "options"
  | "roadmap"
  | "step_guidance"
  | "work_evaluation"
  | "normalize"
  | "portfolio_curation"
  | "portfolio_export"
  | "legacy";
export type WebSearchReason = "recency_sensitive" | "source_seeking" | "user_requested_current";
export type GenerationFailureKind =
  | "auth"
  | "incomplete"
  | "model_access"
  | "no_parsed_content"
  | "provider"
  | "rate_limit"
  | "refusal"
  | "validation"
  | "unknown";

export interface GenerationCitation {
  title?: string;
  url: string;
  start_index?: number;
  end_index?: number;
}

export interface WebSearchPolicy {
  enabled: boolean;
  allowedDomains?: string[];
  reason: WebSearchReason;
}

export interface GenerationMetrics {
  stage: GenerationStage | string;
  generation_version: string;
  model: string;
  attempt_count: number;
  ai_total_ms: number;
  validation_ms: number;
  prompt_chars: number;
  output_chars: number;
  fallback_used: boolean;
  fallback_model_used: string | null;
  validator_failed: boolean;
  validator_issue_count: number;
  tool_used: boolean;
  web_search_used: boolean;
  citation_count: number;
  refusal_detected: boolean;
  quality_issue_count: number;
  quality_issue_kinds: QualityIssueKind[];
  quality_repair_used: boolean;
  quality_escalation_used: boolean;
  quality_fallback_used: boolean;
  title_regenerated: boolean;
}

export interface GenerationFailureDetails {
  kind: GenerationFailureKind;
  message: string;
  raw: unknown;
  metrics: GenerationMetrics;
}

interface StructuredGenerationInput<TSchema extends z.ZodTypeAny> {
  schema: TSchema;
  schemaName?: string;
  stage?: GenerationStage | string;
  systemPrompt: string;
  userPrompt: string;
  maxRetries?: number;
  validator?: (parsed: z.infer<TSchema>) => string[];
  model?: string;
  fallbackModels?: string[];
  maxCompletionTokens?: number;
  reasoningEffort?: "low" | "medium" | "high";
  webSearch?: WebSearchPolicy;
  qualitySpec?: FieldSpecMap;
  qualityAllowedTerms?: readonly string[];
}

const GENERATION_VERSION = "responses-v1";
const ACCESS_DENIED_PATTERN = /does not have access to model/i;
const RATE_LIMIT_PATTERN = /\b429\b|rate limit/i;
const AUTH_PATTERN = /\b401\b|invalid api key|incorrect api key|authentication/i;

function supportsReasoningEffort(model: string) {
  return model.toLowerCase().startsWith("gpt-5");
}

function uniqueModels(primary: string, fallbacks: string[]) {
  const models: string[] = [];
  for (const model of [primary, ...fallbacks]) {
    const trimmed = model.trim();
    if (!trimmed || models.includes(trimmed)) {
      continue;
    }

    models.push(trimmed);
  }

  return models;
}

function resolveStageModel(stage: GenerationStage | string, explicitModel?: string) {
  if (explicitModel?.trim()) {
    return explicitModel.trim();
  }

  if (stage === "normalize" && env.OPENAI_NORMALIZE_MODEL?.trim()) {
    return env.OPENAI_NORMALIZE_MODEL.trim();
  }

  if (stage === "options" && env.OPENAI_STAGE1_MODEL?.trim()) {
    return env.OPENAI_STAGE1_MODEL.trim();
  }

  if (stage === "roadmap" && env.OPENAI_STAGE2_MODEL?.trim()) {
    return env.OPENAI_STAGE2_MODEL.trim();
  }

  if (stage === "step_guidance" && env.OPENAI_STAGE3_MODEL?.trim()) {
    return env.OPENAI_STAGE3_MODEL.trim();
  }

  return env.OPENAI_MODEL;
}

function getStageDefaults(stage: GenerationStage | string) {
  if (stage === "normalize") {
    return { maxCompletionTokens: 2400, maxRetries: 1, reasoningEffort: "low" as const };
  }

  if (stage === "options") {
    return { maxCompletionTokens: 4000, maxRetries: 1, reasoningEffort: "low" as const };
  }

  if (stage === "roadmap") {
    return { maxCompletionTokens: 5200, maxRetries: 1, reasoningEffort: "low" as const };
  }

  if (stage === "step_guidance") {
    return { maxCompletionTokens: 4600, maxRetries: 1, reasoningEffort: "low" as const };
  }

  if (stage === "work_evaluation") {
    return { maxCompletionTokens: 2200, maxRetries: 1, reasoningEffort: "low" as const };
  }

  if (stage === "portfolio_curation") {
    return { maxCompletionTokens: 1600, maxRetries: 1, reasoningEffort: "low" as const };
  }

  if (stage === "portfolio_export") {
    return { maxCompletionTokens: 1800, maxRetries: 1, reasoningEffort: "low" as const };
  }

  return { maxCompletionTokens: 1800, maxRetries: 2, reasoningEffort: undefined };
}

function getRetryTokenBudget(maxCompletionTokens: number) {
  return Math.min(maxCompletionTokens + 1600, 8000);
}

function getFailureKindFromMessage(message: string): GenerationFailureKind {
  if (ACCESS_DENIED_PATTERN.test(message)) {
    return "model_access";
  }

  if (RATE_LIMIT_PATTERN.test(message)) {
    return "rate_limit";
  }

  if (AUTH_PATTERN.test(message)) {
    return "auth";
  }

  return "provider";
}

function buildFailureMetrics(input: {
  stage: GenerationStage | string;
  model: string;
  attemptCount: number;
  totalAiMs: number;
  totalValidationMs: number;
  promptChars: number;
  outputChars: number;
  fallbackModelUsed: string | null;
  validatorFailed: boolean;
  validatorIssueCount: number;
  refusalDetected: boolean;
  qualityIssueCount?: number;
  qualityIssueKinds?: QualityIssueKind[];
  qualityRepairUsed?: boolean;
  qualityEscalationUsed?: boolean;
  qualityFallbackUsed?: boolean;
  titleRegenerated?: boolean;
}): GenerationMetrics {
  return {
    stage: input.stage,
    generation_version: GENERATION_VERSION,
    model: input.model,
    attempt_count: input.attemptCount,
    ai_total_ms: Math.round(input.totalAiMs),
    validation_ms: Math.round(input.totalValidationMs),
    prompt_chars: input.promptChars,
    output_chars: input.outputChars,
    fallback_used: input.fallbackModelUsed !== null,
    fallback_model_used: input.fallbackModelUsed,
    validator_failed: input.validatorFailed,
    validator_issue_count: input.validatorIssueCount,
    tool_used: false,
    web_search_used: false,
    citation_count: 0,
    refusal_detected: input.refusalDetected,
    quality_issue_count: input.qualityIssueCount ?? 0,
    quality_issue_kinds: input.qualityIssueKinds ?? [],
    quality_repair_used: input.qualityRepairUsed ?? false,
    quality_escalation_used: input.qualityEscalationUsed ?? false,
    quality_fallback_used: input.qualityFallbackUsed ?? false,
    title_regenerated: input.titleRegenerated ?? false,
  };
}

export class StructuredGenerationError extends Error {
  readonly details: GenerationFailureDetails;

  constructor(details: GenerationFailureDetails) {
    super(details.message);
    this.name = "StructuredGenerationError";
    this.details = details;
  }
}

export function getGenerationFailureDetails(error: unknown): GenerationFailureDetails | null {
  if (error instanceof StructuredGenerationError) {
    return error.details;
  }

  return null;
}

export function getGenerationFailureStatus(error: unknown) {
  const details = getGenerationFailureDetails(error);
  if (!details) {
    return 500;
  }

  if (details.kind === "rate_limit") {
    return 429;
  }

  if (details.kind === "auth" || details.kind === "model_access") {
    return 503;
  }

  return 502;
}

export function getGenerationFailureMessage(error: unknown, fallback: string) {
  const details = getGenerationFailureDetails(error);
  if (!details) {
    return fallback;
  }

  if (details.kind === "model_access") {
    return "AI generation is temporarily unavailable because the configured model is not enabled for this project.";
  }

  if (details.kind === "rate_limit") {
    return "AI generation is temporarily rate-limited. Please retry in a moment.";
  }

  if (details.kind === "incomplete" || details.kind === "no_parsed_content") {
    return "AI generation could not finish the structured response. Please retry.";
  }

  if (details.kind === "auth") {
    return "AI generation is temporarily unavailable due to an authentication issue.";
  }

  if (details.kind === "refusal") {
    return "AI generation refused this request. Please revise the input and try again.";
  }

  if (details.kind === "validation") {
    return "AI generation returned an invalid response. Please retry.";
  }

  return fallback;
}

function logGenerationAttempt(event: string, payload: Record<string, unknown>) {
  console.info(`[ai] ${event}`, payload);
}

function buildRepairPrompt(feedback: string, escalate = false) {
  const lines = ["The previous attempt failed validation.", feedback];
  if (escalate) {
    lines.push(
      "IMPORTANT: Previous attempts produced truncated or contaminated content. Every field MUST be a complete sentence ending in terminal punctuation (. ! ?). Do not truncate mid-word. Write in English only. If a field would exceed its length budget, write a shorter but COMPLETE version instead of cutting mid-sentence.",
    );
  }
  lines.push("Regenerate the full JSON from scratch and fix every issue.");
  return lines.join("\n");
}

function extractRefusal<TParsed>(response: ParsedResponse<TParsed>) {
  const refusals: string[] = [];

  for (const item of response.output) {
    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content) {
      if (content.type === "refusal" && content.refusal.trim().length > 0) {
        refusals.push(content.refusal.trim());
      }
    }
  }

  return refusals.length > 0 ? refusals.join("\n\n") : null;
}

function extractCitations<TParsed>(response: ParsedResponse<TParsed>): GenerationCitation[] {
  const citations = new Map<string, GenerationCitation>();

  for (const item of response.output) {
    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content) {
      if (content.type !== "output_text") {
        continue;
      }

      for (const annotation of content.annotations) {
        if (annotation.type !== "url_citation") {
          continue;
        }

        const key = [annotation.url, annotation.title, annotation.start_index, annotation.end_index].join("|");
        citations.set(key, {
          title: annotation.title,
          url: annotation.url,
          start_index: annotation.start_index,
          end_index: annotation.end_index,
        });
      }
    }
  }

  return Array.from(citations.values());
}

function didUseWebSearch<TParsed>(response: ParsedResponse<TParsed>) {
  return response.output.some((item) => item.type === "web_search_call");
}

function buildWebSearchTool(policy: WebSearchPolicy) {
  const tool: {
    type: "web_search_preview_2025_03_11";
    search_context_size: "medium";
    user_location: {
      type: "approximate";
      country: string;
      timezone: string;
    };
    filters?: {
      allowed_domains: string[];
    };
  } = {
    type: "web_search_preview_2025_03_11",
    search_context_size: "medium",
    user_location: {
      type: "approximate",
      country: "US",
      timezone: "America/New_York",
    },
  };

  if (policy.allowedDomains && policy.allowedDomains.length > 0) {
    tool.filters = {
      allowed_domains: policy.allowedDomains,
    };
  }

  return tool;
}

function buildRawResponse<TParsed>(
  response: ParsedResponse<TParsed>,
  citations: GenerationCitation[],
  refusal: string | null,
  webSearchPolicy?: WebSearchPolicy,
) {
  return {
    id: response.id,
    model: response.model,
    status: response.status,
    incomplete_details: response.incomplete_details ?? null,
    usage: response.usage ?? null,
    output_text: response.output_text ?? null,
    output: response.output,
    citations,
    refusal,
    tooling: {
      web_search_requested: webSearchPolicy?.enabled ?? false,
      web_search_reason: webSearchPolicy?.enabled ? webSearchPolicy.reason : null,
    },
  };
}

export async function generateStructuredOutput<TSchema extends z.ZodTypeAny>(
  input: StructuredGenerationInput<TSchema>,
): Promise<{
  parsed: z.infer<TSchema>;
  raw: unknown;
  metrics: GenerationMetrics;
  citations: GenerationCitation[];
  refusal: string | null;
}> {
  const stage = input.stage ?? "legacy";
  const defaults = getStageDefaults(stage);
  const maxRetries = input.maxRetries ?? defaults.maxRetries;
  const primaryModel = resolveStageModel(stage, input.model);
  const modelsToTry = uniqueModels(primaryModel, [
    env.OPENAI_FALLBACK_MODEL,
    ...(input.fallbackModels ?? []),
  ]);
  const maxCompletionTokens = input.maxCompletionTokens ?? defaults.maxCompletionTokens;
  let lastError = "Structured generation failed";
  let totalAiMs = 0;
  let totalValidationMs = 0;
  let lastOutputChars = 0;
  let attemptCount = 0;
  let lastPromptChars = input.systemPrompt.length + input.userPrompt.length;
  let validatorFailed = false;
  let validatorIssueCount = 0;
  let refusalDetected = false;
  let lastFallbackModelUsed: string | null = null;
  let lastRaw: unknown = null;
  let lastFailureKind: GenerationFailureKind = "unknown";
  let lastValidParsed: z.infer<TSchema> | null = null;
  let qualityIssueCount = 0;
  const qualityIssueKindSet = new Set<QualityIssueKind>();
  let qualityRepairUsed = false;
  let qualityEscalationUsed = false;
  let qualityIssuesThisCycle = false;
  let lastSemanticIssueCount = 0;

  for (const modelName of modelsToTry) {
    let repairFeedback: string | null = null;
    let tokenBudget = maxCompletionTokens;
    let tokenBudgetRetried = false;

    logGenerationAttempt("model-start", {
      stage,
      model: modelName,
      primary_model: primaryModel,
      fallback_candidate: modelName !== primaryModel,
    });

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      attemptCount += 1;
      lastPromptChars =
        input.systemPrompt.length + input.userPrompt.length + (repairFeedback ? repairFeedback.length : 0);

      const messages: Array<{ role: "system" | "user"; content: string }> = [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ];

      if (repairFeedback) {
        messages.push({ role: "user", content: buildRepairPrompt(repairFeedback, qualityEscalationUsed) });
      }

      const request = {
        model: modelName,
        input: messages,
        max_output_tokens: tokenBudget,
        ...(supportsReasoningEffort(modelName) && (input.reasoningEffort ?? defaults.reasoningEffort)
          ? { reasoning: { effort: input.reasoningEffort ?? defaults.reasoningEffort } }
          : {}),
        text: {
          format: zodTextFormat(input.schema, input.schemaName ?? `sevri_${String(stage)}`),
        },
        ...(input.webSearch?.enabled
          ? {
              tools: [buildWebSearchTool(input.webSearch)],
              include: ["web_search_call.action.sources"],
              tool_choice: "auto",
            }
          : {}),
      };

      const startedAt = performance.now();

      try {
        logGenerationAttempt("attempt-start", {
          stage,
          attempt: attemptCount,
          attempt_in_model: attempt + 1,
          requested_model: modelName,
          max_output_tokens: tokenBudget,
          reasoning_effort: supportsReasoningEffort(modelName) ? input.reasoningEffort ?? defaults.reasoningEffort ?? null : null,
          repair_feedback: repairFeedback !== null,
        });

        const response = (await openai.responses.parse(request as never)) as ParsedResponse<z.infer<TSchema>>;

        totalAiMs += performance.now() - startedAt;

        const refusal = extractRefusal(response);
        const citations = extractCitations(response);
        const toolUsed = didUseWebSearch(response);
        const raw = buildRawResponse(response, citations, refusal, input.webSearch);
        lastRaw = raw;
        lastOutputChars = JSON.stringify(response.output_parsed ?? response.output_text ?? "").length;
        const incompleteReason = response.incomplete_details?.reason ?? null;

        logGenerationAttempt("attempt-finish", {
          stage,
          attempt: attemptCount,
          requested_model: modelName,
          actual_model: response.model,
          status: response.status,
          incomplete_reason: incompleteReason,
          usage: response.usage ?? null,
          output_chars: lastOutputChars,
          fallback_candidate: modelName !== primaryModel,
        });

        if (refusal) {
          refusalDetected = true;
          throw new StructuredGenerationError({
            kind: "refusal",
            message: `${modelName}: Model refusal: ${refusal}`,
            raw,
            metrics: buildFailureMetrics({
              stage,
              model: primaryModel,
              attemptCount,
              totalAiMs,
              totalValidationMs,
              promptChars: lastPromptChars,
              outputChars: lastOutputChars,
              fallbackModelUsed: modelName !== primaryModel ? modelName : lastFallbackModelUsed,
              validatorFailed,
              validatorIssueCount,
              refusalDetected: true,
              qualityIssueCount,
              qualityIssueKinds: Array.from(qualityIssueKindSet),
              qualityRepairUsed,
              qualityEscalationUsed,
            }),
          });
        }

        if (response.status === "incomplete") {
          lastError = `${modelName}: Response incomplete${incompleteReason ? ` (${incompleteReason})` : ""}`;

          if (incompleteReason === "max_output_tokens" && !tokenBudgetRetried) {
            tokenBudget = getRetryTokenBudget(tokenBudget);
            tokenBudgetRetried = true;
            console.warn("[ai] retrying after incomplete response", {
              stage,
              attempt: attemptCount,
              requested_model: modelName,
              actual_model: response.model,
              previous_max_output_tokens: request.max_output_tokens,
              retry_max_output_tokens: tokenBudget,
            });
            continue;
          }

          throw new StructuredGenerationError({
            kind: "incomplete",
            message: lastError,
            raw,
            metrics: buildFailureMetrics({
              stage,
              model: primaryModel,
              attemptCount,
              totalAiMs,
              totalValidationMs,
              promptChars: lastPromptChars,
              outputChars: lastOutputChars,
              fallbackModelUsed: modelName !== primaryModel ? modelName : lastFallbackModelUsed,
              validatorFailed,
              validatorIssueCount,
              refusalDetected,
              qualityIssueCount,
              qualityIssueKinds: Array.from(qualityIssueKindSet),
              qualityRepairUsed,
              qualityEscalationUsed,
            }),
          });
        }

        const parsed = response.output_parsed;
        if (!parsed) {
          lastError = `${modelName}: Model returned no parsed content`;
          throw new StructuredGenerationError({
            kind: "no_parsed_content",
            message: lastError,
            raw,
            metrics: buildFailureMetrics({
              stage,
              model: primaryModel,
              attemptCount,
              totalAiMs,
              totalValidationMs,
              promptChars: lastPromptChars,
              outputChars: lastOutputChars,
              fallbackModelUsed: modelName !== primaryModel ? modelName : lastFallbackModelUsed,
              validatorFailed,
              validatorIssueCount,
              refusalDetected,
              qualityIssueCount,
              qualityIssueKinds: Array.from(qualityIssueKindSet),
              qualityRepairUsed,
              qualityEscalationUsed,
            }),
          });
        }

        lastValidParsed = parsed;

        const validationStartedAt = performance.now();
        const semanticIssues = input.validator ? input.validator(parsed) : [];
        let qualityReport: ContentQualityReport = { issues: [], severity: "clean" };
        if (input.qualitySpec) {
          qualityReport = checkStructured(parsed, input.qualitySpec, {
            allowedTerms: input.qualityAllowedTerms,
          });
          if (qualityReport.issues.length > 0) {
            qualityRepairUsed = true;
            qualityIssueCount += qualityReport.issues.length;
            for (const issue of qualityReport.issues) {
              qualityIssueKindSet.add(issue.kind);
            }
          }
        }
        qualityIssuesThisCycle = qualityReport.issues.length > 0;
        lastSemanticIssueCount = semanticIssues.length;
        const qualityFeedback = buildRepairFeedback(qualityReport);
        const validationIssues = [...semanticIssues, ...qualityFeedback];
        totalValidationMs += performance.now() - validationStartedAt;

        if (validationIssues.length > 0) {
          if (semanticIssues.length > 0) {
            validatorFailed = true;
            validatorIssueCount += semanticIssues.length;
          }
          lastError = `${modelName}: Output validation failed: ${validationIssues.join(" | ")}`;
          repairFeedback = validationIssues.map((issue) => `- ${issue}`).join("\n");
          console.warn("[ai] validation retry requested", {
            stage,
            attempt: attemptCount,
            requested_model: modelName,
            semantic_issue_count: semanticIssues.length,
            quality_issue_count: qualityReport.issues.length,
            quality_kinds: Array.from(new Set(qualityReport.issues.map((i) => i.kind))),
          });

          // Tier 2: on repeat quality failure, escalate system message and bump token budget once.
          if (qualityReport.issues.length > 0 && attempt >= 1 && !qualityEscalationUsed) {
            qualityEscalationUsed = true;
            if (!tokenBudgetRetried) {
              const bumped = getRetryTokenBudget(tokenBudget);
              if (bumped > tokenBudget) {
                tokenBudget = bumped;
                tokenBudgetRetried = true;
              }
            }
          }

          if (attempt === maxRetries) {
            break;
          }

          continue;
        }

        return {
          parsed,
          raw,
          citations,
          refusal,
          metrics: {
            stage,
            generation_version: GENERATION_VERSION,
            model: response.model,
            attempt_count: attemptCount,
            ai_total_ms: Math.round(totalAiMs),
            validation_ms: Math.round(totalValidationMs),
            prompt_chars: lastPromptChars,
            output_chars: lastOutputChars,
            fallback_used: modelName !== primaryModel,
            fallback_model_used: modelName !== primaryModel ? modelName : null,
            validator_failed: validatorFailed,
            validator_issue_count: validatorIssueCount,
            tool_used: toolUsed,
            web_search_used: toolUsed,
            citation_count: citations.length,
            refusal_detected: refusalDetected,
            quality_issue_count: qualityIssueCount,
            quality_issue_kinds: Array.from(qualityIssueKindSet),
            quality_repair_used: qualityRepairUsed,
            quality_escalation_used: qualityEscalationUsed,
            quality_fallback_used: false,
            title_regenerated: false,
          },
        };
      } catch (error) {
        if (error instanceof StructuredGenerationError) {
          lastFailureKind = error.details.kind;
          lastError = error.details.message;
          lastRaw = error.details.raw;
          lastOutputChars = error.details.metrics.output_chars;
          refusalDetected = refusalDetected || error.details.metrics.refusal_detected;

          if (modelName !== primaryModel) {
            lastFallbackModelUsed = modelName;
          }

          console.warn("[ai] structured-attempt-error", {
            stage,
            attempt: attemptCount,
            requested_model: modelName,
            kind: error.details.kind,
            error: error.details.message,
          });

          if (error.details.kind === "auth") {
            throw error;
          }

          break;
        }

        totalAiMs += performance.now() - startedAt;
        lastError = error instanceof Error ? `${modelName}: ${error.message}` : `${modelName}: Unknown generation error`;
        repairFeedback = lastError;

        const failureKind = getFailureKindFromMessage(lastError);
        lastFailureKind = failureKind;
        console.warn("[ai] attempt-error", {
          stage,
          attempt: attemptCount,
          requested_model: modelName,
          error: lastError,
          kind: failureKind,
        });

        if (modelName !== primaryModel) {
          lastFallbackModelUsed = modelName;
        }

        if (failureKind === "auth") {
          throw new StructuredGenerationError({
            kind: failureKind,
            message: lastError,
            raw: lastRaw,
            metrics: buildFailureMetrics({
              stage,
              model: primaryModel,
              attemptCount,
              totalAiMs,
              totalValidationMs,
              promptChars: lastPromptChars,
              outputChars: lastOutputChars,
              fallbackModelUsed: lastFallbackModelUsed,
              validatorFailed,
              validatorIssueCount,
              refusalDetected,
              qualityIssueCount,
              qualityIssueKinds: Array.from(qualityIssueKindSet),
              qualityRepairUsed,
              qualityEscalationUsed,
            }),
          });
        }

        if (failureKind === "model_access" || failureKind === "rate_limit") {
          break;
        }

        if (attempt === maxRetries) {
          break;
        }
      }
    }
  }

  // Tier 3 — deterministic cleanup: if we have a last-parsed object and the
  // outstanding failure is quality-only (no semantic validator issues on the
  // final attempt), clean the bad fields and return success.
  if (
    input.qualitySpec &&
    lastValidParsed !== null &&
    qualityIssuesThisCycle &&
    lastSemanticIssueCount === 0
  ) {
    const cleanup = applyStructuredCleanup(lastValidParsed, input.qualitySpec);
    console.warn("[ai] quality fallback applied", {
      stage,
      attempts: attemptCount,
      changed_paths: cleanup.changedPaths,
      quality_kinds: Array.from(qualityIssueKindSet),
    });
    return {
      parsed: cleanup.cleaned,
      raw: lastRaw,
      citations: [],
      refusal: null,
      metrics: {
        stage,
        generation_version: GENERATION_VERSION,
        model: primaryModel,
        attempt_count: attemptCount,
        ai_total_ms: Math.round(totalAiMs),
        validation_ms: Math.round(totalValidationMs),
        prompt_chars: lastPromptChars,
        output_chars: lastOutputChars,
        fallback_used: lastFallbackModelUsed !== null,
        fallback_model_used: lastFallbackModelUsed,
        validator_failed: validatorFailed,
        validator_issue_count: validatorIssueCount,
        tool_used: false,
        web_search_used: false,
        citation_count: 0,
        refusal_detected: refusalDetected,
        quality_issue_count: qualityIssueCount,
        quality_issue_kinds: Array.from(qualityIssueKindSet),
        quality_repair_used: qualityRepairUsed,
        quality_escalation_used: qualityEscalationUsed,
        quality_fallback_used: true,
        title_regenerated: false,
      },
    };
  }

  throw new StructuredGenerationError({
    kind: validatorFailed ? "validation" : lastFailureKind,
    message: lastError,
    raw: lastRaw,
    metrics: buildFailureMetrics({
      stage,
      model: primaryModel,
      attemptCount,
      totalAiMs,
      totalValidationMs,
      promptChars: lastPromptChars,
      outputChars: lastOutputChars,
      fallbackModelUsed: lastFallbackModelUsed,
      validatorFailed,
      validatorIssueCount,
      refusalDetected,
      qualityIssueCount,
      qualityIssueKinds: Array.from(qualityIssueKindSet),
      qualityRepairUsed,
      qualityEscalationUsed,
    }),
  });
}

export function getGenerationVersion() {
  return GENERATION_VERSION;
}
