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
}

function supportsTemperatureOverride(model: string) {
  return !model.toLowerCase().startsWith("gpt-5");
}

function parseJsonSafely(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    // Fallback for occasional code-fence wrappers.
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

export async function generateStructuredOutput<TSchema extends z.ZodTypeAny>(
  input: StructuredGenerationInput<TSchema>,
): Promise<{ parsed: z.infer<TSchema>; raw: unknown }> {
  const retries = input.maxRetries ?? 2;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      response_format: { type: "json_object" },
      ...(supportsTemperatureOverride(env.OPENAI_MODEL) ? { temperature: 0.4 } : {}),
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      if (attempt === retries) {
        throw new Error("Model returned empty content");
      }
      continue;
    }

    let parsedJson: unknown;
    try {
      parsedJson = parseJsonSafely(content);
    } catch {
      if (attempt === retries) {
        throw new Error("Model returned non-JSON output");
      }
      continue;
    }

    const matched = findSchemaMatch(input.schema, parsedJson);
    if (!matched) {
      if (attempt === retries) {
        const directError = input.schema.safeParse(parsedJson);
        if (!directError.success) {
          throw new Error(`Schema validation failed: ${directError.error.message}`);
        }
        throw new Error("Schema validation failed");
      }
      continue;
    }

    return {
      parsed: matched,
      raw: parsedJson,
    };
  }

  throw new Error("Structured generation failed");
}
