import { z } from "zod";
import {
  applyStructuredCleanup,
  checkStructured,
  type ContentQualityReport,
  type FieldSpecMap,
} from "./content-quality.ts";

export interface StructuredCleanupValidation<T> {
  cleaned: T;
  changedPaths: string[];
  parsed: T | null;
  schemaIssues: string[];
  semanticIssues: string[];
  qualityReport: ContentQualityReport;
}

export interface StructuredCandidateValidation<T> {
  parsed: T | null;
  schemaIssues: string[];
  semanticIssues: string[];
  qualityReport: ContentQualityReport;
}

function formatSchemaIssue(issue: z.ZodIssue) {
  const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
  return `${path}: ${issue.message}`;
}

export function validateStructuredCandidate<TSchema extends z.ZodTypeAny>(input: {
  candidate: z.infer<TSchema>;
  schema: TSchema;
  qualitySpec: FieldSpecMap;
  qualityAllowedTerms?: readonly string[];
  validator?: (parsed: z.infer<TSchema>) => string[];
}): StructuredCandidateValidation<z.infer<TSchema>> {
  const schemaResult = input.schema.safeParse(input.candidate);
  const schemaIssues = schemaResult.success
    ? []
    : schemaResult.error.issues.map(formatSchemaIssue);
  const candidate = schemaResult.success ? schemaResult.data : input.candidate;
  let semanticIssues: string[] = [];

  if (input.validator) {
    try {
      semanticIssues = input.validator(candidate);
    } catch (error) {
      semanticIssues = [
        `Semantic validation failed: ${
          error instanceof Error ? error.message : "unknown validator error"
        }`,
      ];
    }
  }

  const qualityReport = checkStructured(candidate, input.qualitySpec, {
    allowedTerms: input.qualityAllowedTerms,
  });
  const parsed =
    schemaResult.success &&
    semanticIssues.length === 0 &&
    qualityReport.issues.length === 0
      ? schemaResult.data
      : null;

  return { parsed, schemaIssues, semanticIssues, qualityReport };
}

/**
 * Tier-three cleanup starts from schema-valid data, but changing a string can
 * invalidate length refinements or semantic relationships. Treat cleanup as a
 * fresh candidate and require it to pass the complete validation stack again.
 */
export function applyAndValidateStructuredCleanup<TSchema extends z.ZodTypeAny>(input: {
  parsed: z.infer<TSchema>;
  schema: TSchema;
  qualitySpec: FieldSpecMap;
  qualityAllowedTerms?: readonly string[];
  validator?: (parsed: z.infer<TSchema>) => string[];
}): StructuredCleanupValidation<z.infer<TSchema>> {
  const cleanup = applyStructuredCleanup(input.parsed, input.qualitySpec);
  const validation = validateStructuredCandidate({
    candidate: cleanup.cleaned,
    schema: input.schema,
    qualitySpec: input.qualitySpec,
    qualityAllowedTerms: input.qualityAllowedTerms,
    validator: input.validator,
  });

  return {
    cleaned: cleanup.cleaned,
    changedPaths: cleanup.changedPaths,
    parsed: validation.parsed,
    schemaIssues: validation.schemaIssues,
    semanticIssues: validation.semanticIssues,
    qualityReport: validation.qualityReport,
  };
}
