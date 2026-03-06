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

export async function generateStructuredOutput<TSchema extends z.ZodTypeAny>(
  input: StructuredGenerationInput<TSchema>,
): Promise<{ parsed: z.infer<TSchema>; raw: unknown }> {
  const retries = input.maxRetries ?? 2;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
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
      parsedJson = JSON.parse(content);
    } catch {
      if (attempt === retries) {
        throw new Error("Model returned non-JSON output");
      }
      continue;
    }

    const validated = input.schema.safeParse(parsedJson);
    if (!validated.success) {
      if (attempt === retries) {
        throw new Error(`Schema validation failed: ${validated.error.message}`);
      }
      continue;
    }

    return {
      parsed: validated.data,
      raw: parsedJson,
    };
  }

  throw new Error("Structured generation failed");
}