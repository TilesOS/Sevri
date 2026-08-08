import { z } from "zod";
import type {
  ContentQualityReport,
  FieldSpec,
  FieldSpecMap,
  QualityIssue,
} from "./content-quality.ts";
import { getFieldSpecForPath } from "./content-quality.ts";

export const QualityFieldRepairBatchSchema = z.object({
  repairs: z
    .array(
      z.object({
        path: z.string().min(1),
        replacement: z.string().min(1),
      }),
    )
    .min(1)
    .max(64),
});

export type QualityFieldRepairBatch = z.infer<typeof QualityFieldRepairBatchSchema>;

export interface QualityRepairTarget {
  path: string;
  current_value: string;
  issues: Array<Pick<QualityIssue, "kind" | "detail">>;
  constraints: Pick<FieldSpec, "kind" | "minCredible" | "maxLength">;
}

const SAFE_LOCAL_REPAIR_KINDS = new Set<QualityIssue["kind"]>([
  "missing_terminal_punct",
  "zero_width",
]);

export function canUseDeterministicQualityCleanup(report: ContentQualityReport): boolean {
  return report.issues.length > 0 && report.issues.every((issue) =>
    SAFE_LOCAL_REPAIR_KINDS.has(issue.kind)
  );
}

export function shouldSkipCrossModelFallbackForQuality(input: {
  isPrimaryModel: boolean;
  semanticIssueCount: number;
  qualityIssueCount: number;
  repairFailureAllowsFallback: boolean;
}): boolean {
  return input.isPrimaryModel &&
    input.semanticIssueCount === 0 &&
    input.qualityIssueCount > 0 &&
    !input.repairFailureAllowsFallback;
}

function pathTokens(path: string): Array<{ kind: "key" | "index"; value: string }> {
  const tokens: Array<{ kind: "key" | "index"; value: string }> = [];
  const pattern = /([^.[\]]+)|\[(\d+)\]/gu;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(path)) !== null) {
    if (match[1] !== undefined) {
      tokens.push({ kind: "key", value: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ kind: "index", value: match[2] });
    }
  }

  return tokens;
}

function cloneValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => cloneValue(item)) as unknown as T;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = cloneValue(inner);
    }
    return out as unknown as T;
  }
  return value;
}

export function getStringAtPath(root: unknown, path: string): string | null {
  let node = root;

  for (const token of pathTokens(path)) {
    if (token.kind === "key" && node && typeof node === "object" && !Array.isArray(node)) {
      node = (node as Record<string, unknown>)[token.value];
      continue;
    }
    if (token.kind === "index" && Array.isArray(node)) {
      node = node[Number(token.value)];
      continue;
    }
    return null;
  }

  return typeof node === "string" ? node : null;
}

function setStringAtPath(root: unknown, path: string, replacement: string): boolean {
  const tokens = pathTokens(path);
  if (tokens.length === 0) return false;

  let node = root;
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    if (token.kind === "key" && node && typeof node === "object" && !Array.isArray(node)) {
      node = (node as Record<string, unknown>)[token.value];
      continue;
    }
    if (token.kind === "index" && Array.isArray(node)) {
      node = node[Number(token.value)];
      continue;
    }
    return false;
  }

  const finalToken = tokens[tokens.length - 1];
  if (finalToken.kind === "key" && node && typeof node === "object" && !Array.isArray(node)) {
    const record = node as Record<string, unknown>;
    if (typeof record[finalToken.value] !== "string") return false;
    record[finalToken.value] = replacement;
    return true;
  }
  if (finalToken.kind === "index" && Array.isArray(node)) {
    const arrayIndex = Number(finalToken.value);
    if (typeof node[arrayIndex] !== "string") return false;
    node[arrayIndex] = replacement;
    return true;
  }

  return false;
}

export function buildQualityRepairTargets(
  parsed: unknown,
  report: ContentQualityReport,
  specs: FieldSpecMap,
): QualityRepairTarget[] {
  const grouped = new Map<string, QualityIssue[]>();
  for (const issue of report.issues) {
    const existing = grouped.get(issue.path) ?? [];
    existing.push(issue);
    grouped.set(issue.path, existing);
  }

  const targets: QualityRepairTarget[] = [];
  for (const [path, issues] of grouped) {
    const currentValue = getStringAtPath(parsed, path);
    const spec = getFieldSpecForPath(specs, path);
    if (currentValue === null || !spec) continue;

    targets.push({
      path,
      current_value: currentValue,
      issues: issues.map((issue) => ({ kind: issue.kind, detail: issue.detail })),
      constraints: {
        kind: spec.kind,
        minCredible: spec.minCredible,
        maxLength: spec.maxLength,
      },
    });
  }

  return targets;
}

export function buildQualityRepairPrompts(input: {
  stage: string;
  original: unknown;
  targets: QualityRepairTarget[];
}) {
  const systemPrompt = [
    "You are a surgical copy editor repairing a structured AI response.",
    "Return exactly one replacement for every requested path and no replacements for any other path.",
    "Preserve the original facts, project identity, difficulty, scope, scores, tools, URLs, and creative direction.",
    "Change only the requested strings. Complete truncated thoughts, remove broken or mixed-script characters, balance punctuation, and stay inside each field's length limits.",
    "A replacement must be a useful complete field, not merely the broken suffix removed from the old value.",
    "Do not introduce new claims, projects, resources, or URLs.",
  ].join(" ");

  const userPrompt = [
    `Generation stage: ${input.stage}`,
    "Original structured response for context:",
    JSON.stringify(input.original, null, 2),
    "Fields requiring repair:",
    JSON.stringify(input.targets, null, 2),
    "Return the repairs in the requested structured format. Copy every path exactly.",
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

export function applyQualityFieldRepairs<T>(input: {
  base: T;
  batch: QualityFieldRepairBatch;
  expectedPaths: readonly string[];
}): { candidate: T | null; issues: string[] } {
  const expected = new Set(input.expectedPaths);
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const repair of input.batch.repairs) {
    if (!expected.has(repair.path)) {
      issues.push(`Unexpected repair path: ${repair.path}`);
      continue;
    }
    if (seen.has(repair.path)) {
      issues.push(`Duplicate repair path: ${repair.path}`);
      continue;
    }
    seen.add(repair.path);
  }

  for (const path of expected) {
    if (!seen.has(path)) {
      issues.push(`Missing repair path: ${path}`);
    }
  }

  if (issues.length > 0) {
    return { candidate: null, issues };
  }

  const candidate = cloneValue(input.base);
  for (const repair of input.batch.repairs) {
    if (!setStringAtPath(candidate, repair.path, repair.replacement.trim())) {
      issues.push(`Could not apply repair path: ${repair.path}`);
    }
  }

  return issues.length === 0
    ? { candidate, issues: [] }
    : { candidate: null, issues };
}
