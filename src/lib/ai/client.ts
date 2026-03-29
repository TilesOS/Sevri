import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";

const env = getServerEnv();
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type GenerationStage = "options" | "roadmap" | "step_guidance" | "normalize" | "legacy";

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
}

const GENERATION_VERSION = "fast-staged-v2";

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
  if (stage === "options") {
    return { maxCompletionTokens: 800, maxRetries: 0, reasoningEffort: "low" as const };
  }

  if (stage === "roadmap") {
    return { maxCompletionTokens: 1400, maxRetries: 1, reasoningEffort: "low" as const };
  }

  if (stage === "step_guidance") {
    return { maxCompletionTokens: 1800, maxRetries: 1, reasoningEffort: "low" as const };
  }

  return { maxCompletionTokens: 1200, maxRetries: 2, reasoningEffort: undefined };
}

function buildRepairPrompt(feedback: string) {
  return [
    "The previous attempt failed validation.",
    feedback,
    "Regenerate the full JSON from scratch and fix every issue.",
  ].join("\n");
}

export async function generateStructuredOutput<TSchema extends z.ZodTypeAny>(
  input: StructuredGenerationInput<TSchema>,
): Promise<{ parsed: z.infer<TSchema>; raw: unknown; metrics: GenerationMetrics }> {
  const stage = input.stage ?? "legacy";
  const defaults = getStageDefaults(stage);
  const maxRetries = input.maxRetries ?? defaults.maxRetries;
  const model = resolveStageModel(stage, input.model);
  const modelsToTry = uniqueModels(model, input.fallbackModels ?? []);
  const maxCompletionTokens = input.maxCompletionTokens ?? defaults.maxCompletionTokens;
  let lastError = "Structured generation failed";
  let totalAiMs = 0;
  let totalValidationMs = 0;
  let lastOutputChars = 0;
  let attemptCount = 0;

  for (const modelName of modelsToTry) {
    let repairFeedback: string | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      attemptCount += 1;
      const promptChars =
        input.systemPrompt.length + input.userPrompt.length + (repairFeedback ? repairFeedback.length : 0);
      const messages: Array<{ role: "system" | "user"; content: string }> = [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ];

      if (repairFeedback) {
        messages.push({ role: "user", content: buildRepairPrompt(repairFeedback) });
      }

      const startedAt = performance.now();

      try {
        const completion = await openai.beta.chat.completions.parse({
          model: modelName,
          messages,
          max_completion_tokens: maxCompletionTokens,
          ...(supportsTemperatureOverride(modelName) ? { temperature: 0.3 } : {}),
          ...(supportsReasoningEffort(modelName) && (input.reasoningEffort ?? defaults.reasoningEffort)
            ? { reasoning_effort: input.reasoningEffort ?? defaults.reasoningEffort }
            : {}),
          response_format: zodResponseFormat(input.schema, input.schemaName ?? `sevri_${String(stage)}`),
        });

        totalAiMs += performance.now() - startedAt;
        const message = completion.choices[0]?.message;
        const parsed = message?.parsed;
        lastOutputChars = JSON.stringify(parsed ?? message?.content ?? "").length;

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
          lastError = `${modelName}: Output validation failed: ${validationIssues.join(" | ")}`;
          repairFeedback = validationIssues.map((issue) => `- ${issue}`).join("\n");
          if (attempt === maxRetries) {
            break;
          }

          continue;
        }

        return {
          parsed,
          raw: {
            model: completion.model,
            id: completion.id,
            usage: completion.usage ?? null,
            finish_reason: completion.choices[0]?.finish_reason ?? null,
          },
          metrics: {
            stage,
            generation_version: GENERATION_VERSION,
            model: completion.model,
            attempt_count: attemptCount,
            ai_total_ms: Math.round(totalAiMs),
            validation_ms: Math.round(totalValidationMs),
            prompt_chars: promptChars,
            output_chars: lastOutputChars,
            fallback_used: false,
          },
        };
      } catch (error) {
        totalAiMs += performance.now() - startedAt;
        lastError = error instanceof Error ? `${modelName}: ${error.message}` : `${modelName}: Unknown generation error`;
        repairFeedback = lastError;

        if (attempt === maxRetries) {
          break;
        }
      }
    }
  }

  throw new Error(
    JSON.stringify({
      message: lastError,
      metrics: {
        stage,
        generation_version: GENERATION_VERSION,
        model,
        attempt_count: attemptCount,
        ai_total_ms: Math.round(totalAiMs),
        validation_ms: Math.round(totalValidationMs),
        prompt_chars: input.systemPrompt.length + input.userPrompt.length,
        output_chars: lastOutputChars,
        fallback_used: true,
      } satisfies GenerationMetrics,
    }),
  );
}

export function getGenerationVersion() {
  return GENERATION_VERSION;
}
