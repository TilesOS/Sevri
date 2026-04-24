import { PROFANITY_WORDS } from "./profanity-wordlist.ts";

export type SafetyFindingKind = "pii" | "profanity" | "bounds";

export interface SafetyFinding {
  kind: SafetyFindingKind;
  field: string;
  message: string;
  excerpt?: string;
}

export interface PublicPortfolioSafetyInput {
  displayName: string;
  projectTitle: string;
  summary: string;
  reflection: string;
  featuredSubmissionExcerpt: string;
}

export interface SafetyResult {
  passed: boolean;
  findings: SafetyFinding[];
}

const PII_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "email address", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu },
  { label: "phone number", pattern: /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/gu },
  { label: "street address", pattern: /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,5}\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way)\b/giu },
  { label: "social security number", pattern: /\b\d{3}-\d{2}-\d{4}\b/gu },
];

const FIELD_LIMITS: Record<keyof PublicPortfolioSafetyInput, { min?: number; max: number }> = {
  displayName: { max: 80 },
  projectTitle: { min: 3, max: 160 },
  summary: { min: 20, max: 1600 },
  reflection: { max: 6000 },
  featuredSubmissionExcerpt: { max: 300 },
};

function excerptAround(text: string, index: number, length: number) {
  const start = Math.max(index - 10, 0);
  return text.slice(start, Math.min(index + length + 10, text.length)).slice(0, 20);
}

function scanPii(field: string, value: string): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  for (const { label, pattern } of PII_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(value)) !== null) {
      findings.push({
        kind: "pii",
        field,
        message: `Contains possible ${label}.`,
        excerpt: excerptAround(value, match.index, match[0].length),
      });
    }
  }
  return findings;
}

function scanProfanity(field: string, value: string): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  const words = PROFANITY_WORDS.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const pattern = new RegExp(`\\b(${words})\\b`, "giu");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    findings.push({
      kind: "profanity",
      field,
      message: "Contains blocked profanity.",
      excerpt: excerptAround(value, match.index, match[0].length),
    });
  }
  return findings;
}

function scanBounds(field: keyof PublicPortfolioSafetyInput, value: string): SafetyFinding[] {
  const limits = FIELD_LIMITS[field];
  const length = value.trim().length;
  const findings: SafetyFinding[] = [];

  if (limits.min !== undefined && length < limits.min) {
    findings.push({
      kind: "bounds",
      field,
      message: `Must be at least ${limits.min} characters.`,
    });
  }

  if (length > limits.max) {
    findings.push({
      kind: "bounds",
      field,
      message: `Must be ${limits.max} characters or fewer.`,
    });
  }

  return findings;
}

export function runSafetyChecks(input: PublicPortfolioSafetyInput): SafetyResult {
  const findings: SafetyFinding[] = [];

  for (const [field, rawValue] of Object.entries(input) as Array<[keyof PublicPortfolioSafetyInput, string]>) {
    const value = rawValue ?? "";
    findings.push(...scanBounds(field, value));
    findings.push(...scanPii(field, value));
    findings.push(...scanProfanity(field, value));
  }

  return {
    passed: findings.length === 0,
    findings,
  };
}
