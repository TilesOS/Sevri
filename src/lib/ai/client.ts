import OpenAI from "openai";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";

const env = getServerEnv();
const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

interface StructuredGenerationInput<TSchema extends z.ZodTypeAny> {
  schema: TSchema;
  systemPrompt: string;
  userPrompt: string;
  maxRetries?: number;
  validator?: (parsed: z.infer<TSchema>) => string[];
}

function supportsTemperatureOverride(model: string) {
  return !model.toLowerCase().startsWith("gpt-5");
}

function parseJsonSafely(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const fenced = content.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(fenced);
  }
}

function findSchemaMatch<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  depth = 0,
): z.infer<TSchema> | null {
  const direct = schema.safeParse(value);
  if (direct.success) {
    return direct.data;
  }

  if (depth >= 3) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = findSchemaMatch(schema, item, depth + 1);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      const nested = findSchemaMatch(schema, nestedValue, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function uniqueModels(primary: string, fallback: string): string[] {
  const models: string[] = [];
  for (const model of [primary, fallback]) {
    const trimmed = model.trim();
    if (!trimmed) {
      continue;
    }
    if (!models.includes(trimmed)) {
      models.push(trimmed);
    }
  }
  return models;
}

function buildRepairPrompt(feedback: string) {
  return [
    "The previous attempt failed validation.",
    feedback,
    "Regenerate the entire JSON from scratch and fix every issue.",
    "Return only valid JSON.",
  ].join("\n");
}

export async function generateStructuredOutput<TSchema extends z.ZodTypeAny>(
  input: StructuredGenerationInput<TSchema>,
): Promise<{ parsed: z.infer<TSchema>; raw: unknown }> {
  const retries = input.maxRetries ?? 2;
  const modelsToTry = uniqueModels(env.OPENAI_MODEL, env.OPENAI_FALLBACK_MODEL);
  let lastError = "Structured generation failed";

  for (const model of modelsToTry) {
    let repairFeedback: string | null = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const messages: Array<{ role: "system" | "user"; content: string }> = [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ];

      if (repairFeedback) {
        messages.push({ role: "user", content: buildRepairPrompt(repairFeedback) });
      }

      const completion = await openai.chat.completions.create({
        model,
        response_format: { type: "json_object" },
        ...(supportsTemperatureOverride(model) ? { temperature: 0.35 } : {}),
        messages,
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        lastError = `${model}: Model returned empty content`;
        repairFeedback = lastError;
        if (attempt === retries) {
          break;
        }
        continue;
      }

      let parsedJson: unknown;
      try {
        parsedJson = parseJsonSafely(content);
      } catch {
        lastError = `${model}: Model returned non-JSON output`;
        repairFeedback = lastError;
        if (attempt === retries) {
          break;
        }
        continue;
      }

      const matched = findSchemaMatch(input.schema, parsedJson);
      if (!matched) {
        const direct = input.schema.safeParse(parsedJson);
        lastError = direct.success
          ? `${model}: Schema validation failed`
          : `${model}: Schema validation failed: ${direct.error.message}`;
        repairFeedback = lastError;

        if (attempt === retries) {
          break;
        }
        continue;
      }

      const validationIssues = input.validator ? input.validator(matched) : [];
      if (validationIssues.length > 0) {
        lastError = `${model}: Output quality validation failed: ${validationIssues.join(" | ")}`;
        repairFeedback = validationIssues.map((issue) => `- ${issue}`).join("\n");

        if (attempt === retries) {
          break;
        }
        continue;
      }

      return {
        parsed: matched,
        raw: parsedJson,
      };
    }
  }

  throw new Error(lastError);
}
