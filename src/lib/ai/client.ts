import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ParsedResponse } from "openai/resources/responses/responses";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";

const env = getServerEnv();
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type GenerationStage = "options" | "roadmap" | "step_guidance" | "work_evaluation" | "normalize" | "legacy";
export type WebSearchReason = "recency_sensitive" | "source_seeking" | "user_requested_current";

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
  temperature?: number;
  reasoningEffort?: "low" | "medium" | "high";
  webSearch?: WebSearchPolicy;
}

const GENERATION_VERSION = "responses-v1";

function supportsTemperatureOverride(model: string) {
  return !model.toLowerCase().startsWith("gpt-5");
}

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
    return { maxCompletionTokens: 1400, maxRetries: 1, reasoningEffort: "medium" as const, temperature: 0.25 };
  }

  if (stage === "options") {
    return { maxCompletionTokens: 1600, maxRetries: 1, reasoningEffort: "medium" as const, temperature: 0.75 };
  }

  if (stage === "roadmap") {
    return { maxCompletionTokens: 2400, maxRetries: 1, reasoningEffort: "medium" as const, temperature: 0.55 };
  }

  if (stage === "step_guidance") {
    return { maxCompletionTokens: 2200, maxRetries: 1, reasoningEffort: "medium" as const, temperature: 0.6 };
  }

  if (stage === "work_evaluation") {
    return { maxCompletionTokens: 900, maxRetries: 1, reasoningEffort: "medium" as const, temperature: 0.2 };
  }

  return { maxCompletionTokens: 1200, maxRetries: 2, reasoningEffort: undefined, temperature: 0.3 };
}

function buildRepairPrompt(feedback: string) {
  return [
    "The previous attempt failed validation.",
    feedback,
    "Regenerate the full JSON from scratch and fix every issue.",
  ].join("\n");
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

  for (const modelName of modelsToTry) {
    let repairFeedback: string | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      attemptCount += 1;
      lastPromptChars =
        input.systemPrompt.length + input.userPrompt.length + (repairFeedback ? repairFeedback.length : 0);

      const messages: Array<{ role: "system" | "user"; content: string }> = [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ];

      if (repairFeedback) {
        messages.push({ role: "user", content: buildRepairPrompt(repairFeedback) });
      }

      const request = {
        model: modelName,
        input: messages,
        max_output_tokens: maxCompletionTokens,
        ...(supportsTemperatureOverride(modelName) ? { temperature: input.temperature ?? defaults.temperature ?? 0.3 } : {}),
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
        const response = (await openai.responses.parse(request as never)) as ParsedResponse<z.infer<TSchema>>;

        totalAiMs += performance.now() - startedAt;

        const refusal = extractRefusal(response);
        const citations = extractCitations(response);
        const toolUsed = didUseWebSearch(response);
        const raw = buildRawResponse(response, citations, refusal, input.webSearch);
        lastRaw = raw;
        lastOutputChars = JSON.stringify(response.output_parsed ?? response.output_text ?? "").length;

        if (refusal) {
          refusalDetected = true;
          lastError = `${modelName}: Model refusal: ${refusal}`;
          if (modelName !== primaryModel) {
            lastFallbackModelUsed = modelName;
          }
          break;
        }

        const parsed = response.output_parsed;
        if (!parsed) {
          lastError = `${modelName}: Model returned no parsed content`;
          repairFeedback = lastError;
          if (attempt === maxRetries) {
            break;
          }

          continue;
        }

        const validationStartedAt = performance.now();
        const validationIssues = input.validator ? input.validator(parsed) : [];
        totalValidationMs += performance.now() - validationStartedAt;

        if (validationIssues.length > 0) {
          validatorFailed = true;
          validatorIssueCount += validationIssues.length;
          lastError = `${modelName}: Output validation failed: ${validationIssues.join(" | ")}`;
          repairFeedback = validationIssues.map((issue) => `- ${issue}`).join("\n");
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
          },
        };
      } catch (error) {
        totalAiMs += performance.now() - startedAt;
        lastError = error instanceof Error ? `${modelName}: ${error.message}` : `${modelName}: Unknown generation error`;
        repairFeedback = lastError;

        if (modelName !== primaryModel) {
          lastFallbackModelUsed = modelName;
        }

        if (attempt === maxRetries) {
          break;
        }
      }
    }
  }

  throw new Error(
    JSON.stringify({
      message: lastError,
      raw: lastRaw,
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
      } satisfies GenerationMetrics,
    }),
  );
}

export function getGenerationVersion() {
  return GENERATION_VERSION;
}
