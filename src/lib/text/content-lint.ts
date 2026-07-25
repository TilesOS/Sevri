// Content lint for composed, user-visible copy.
//
// Every rule here corresponds to a real artifact observed in the product:
// template stitching that pasted a full sentence into a mid-sentence slot,
// third-person references to the student, and internal vocabulary leaking into
// the UI. Anything composed from stored fields must pass `lintProse`.
//
// Pure functions, no I/O.

export type ContentLintCode =
  | "stitched_period_connector"
  | "stitched_question_mark"
  | "double_terminal_punctuation"
  | "lowercase_after_period"
  | "trailing_preposition"
  | "dangling_punctuation"
  | "missing_terminal_punctuation"
  | "zero_width_character"
  | "mixed_script"
  | "third_person_student"
  | "internal_vocabulary"
  | "template_placeholder";

export interface ContentLintIssue {
  code: ContentLintCode;
  detail: string;
  match?: string;
}

export interface ContentLintOptions {
  /** Titles and short labels are not expected to end in terminal punctuation. */
  requireTerminalPunctuation?: boolean;
  /** Technical terms and anchors that may legitimately contain non-Latin script. */
  allowedTerms?: readonly string[];
}

/**
 * A sentence that ended, followed by a lowercase connector that expected to
 * continue it. Produced by `${sentenceField} and avoid feature creep` templates.
 * Deliberately case-sensitive: a capitalized "Then" or "So" begins a legitimate
 * sentence, and only the lowercase form signals a stitched slot.
 */
const STITCHED_PERIOD_CONNECTOR =
  /[.!?…]\s+(and|or|but|with|so|then|plus|while|because|although|though|yet|nor)\b/u;

/** A question mark mid-string followed by a continuation: "...outcomes? with a practical...". */
const STITCHED_QUESTION_MARK = /\?\s+(with|and|or|but|using|for|to|that|which|so)\b/u;

const DOUBLE_TERMINAL_PUNCTUATION = /([.!?])\s*[.!?](?![.!?])|\.{2}(?!\.)/u;

/** A new sentence that starts lowercase — the tell-tale sign of a lowercased slot. */
const LOWERCASE_AFTER_PERIOD = /[.!?]\s+([a-z]\w*)/u;

/**
 * Abbreviations whose internal periods are not sentence boundaries. Masked before
 * the boundary rules run so "e.g. the parser" is not read as a lowercase sentence.
 */
const ABBREVIATIONS =
  /\b(?:e\.g\.|i\.e\.|etc\.|vs\.|cf\.|approx\.|no\.|fig\.|eq\.|Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|St\.|Jr\.|Sr\.)/giu;

/** Replaces abbreviation periods with a placeholder letter of the same length. */
function maskAbbreviations(value: string): string {
  return value.replace(ABBREVIATIONS, (match) => match.replace(/\./gu, "x"));
}

const TRAILING_PREPOSITIONS = new Set([
  "to", "of", "for", "with", "in", "on", "at", "by", "as", "from", "into",
  "onto", "about", "upon", "over", "under", "via", "per", "and", "or", "but",
  "the", "a", "an", "that", "which", "than", "so", "because", "while", "when",
]);

const DANGLING_PUNCTUATION = /[,;:\-–—]$/u;

const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u00AD]/u;

/**
 * A single non-Latin character wedged into a Latin word — the "alias別" artifact.
 * Runs of non-Latin script are also flagged; a legitimate technical term must be
 * passed via `allowedTerms`.
 */
const MIXED_SCRIPT_ADJACENT =
  /(?:[A-Za-z][\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Thai}]|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Thai}][A-Za-z])/u;

const NON_LATIN_RUN =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Devanagari}\p{Script=Thai}]{2,}/u;

/** Third-person references to the reader. The student is always "you". */
const THIRD_PERSON_STUDENT: Array<[RegExp, string]> = [
  [/\bthe student(?:'s|s)?\b/iu, "refers to the reader as \"the student\""],
  [/\bthis student(?:'s|s)?\b/iu, "refers to the reader as \"this student\""],
  [/\bhis or her\b/iu, "third-person possessive"],
];

/** Vocabulary that belongs to the generation pipeline, not to the student. */
const INTERNAL_VOCABULARY: Array<[RegExp, string]> = [
  [/\bSevri's\b/u, "names Sevri in copy addressed to the user"],
  [/\btarget outcome\b/iu, "internal profile field name"],
  [/\bthe profile is\b/iu, "internal profile machinery"],
  [/\bnormalized profile\b/iu, "internal profile machinery"],
  [/\banchor interests\b/iu, "internal profile field name"],
  [/\bfocus signal\b/iu, "internal profile field name"],
  [/\bgoal signal\b/iu, "internal profile field name"],
  [/\bdomain brief\b/iu, "internal profile field name"],
  [/\banti-generic\b/iu, "internal prompt vocabulary"],
  [/\bdelivery bias\b/iu, "internal profile field name"],
];

/** Unfilled template slots. */
const TEMPLATE_PLACEHOLDER = /\{\{?\s*[a-z_][a-z0-9_.]*\s*\}?\}|\$\{[^}]*\}|\[(?:TODO|TBD)\]/iu;

function lastWordOf(value: string): string {
  const match = value.trim().match(/([A-Za-z’']+)[^A-Za-z’']*$/u);
  return match ? match[1].toLowerCase() : "";
}

function stripAllowedTerms(value: string, allowedTerms: readonly string[]): string {
  let out = value;
  for (const term of allowedTerms) {
    if (!term.trim()) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    out = out.replace(new RegExp(escaped, "giu"), " ");
  }
  return out;
}

/**
 * Lints one user-visible string. Returns every issue found; an empty array means
 * the string is safe to show.
 */
export function lintProse(value: string, options: ContentLintOptions = {}): ContentLintIssue[] {
  const issues: ContentLintIssue[] = [];
  if (typeof value !== "string" || value.trim().length === 0) {
    return issues;
  }

  const requireTerminal = options.requireTerminalPunctuation ?? true;
  // Sentence-boundary rules read this copy; the original is kept for the rules
  // that care about the real characters (zero-width, script, vocabulary).
  const boundaryText = maskAbbreviations(value);

  const stitched = boundaryText.match(STITCHED_PERIOD_CONNECTOR);
  if (stitched) {
    issues.push({
      code: "stitched_period_connector",
      detail: "a sentence ends and the next word continues it — a stitched template slot",
      match: stitched[0].trim(),
    });
  }

  const stitchedQuestion = boundaryText.match(STITCHED_QUESTION_MARK);
  if (stitchedQuestion) {
    issues.push({
      code: "stitched_question_mark",
      detail: "a question mark is followed by a continuation clause",
      match: stitchedQuestion[0].trim(),
    });
  }

  const doubled = boundaryText.match(DOUBLE_TERMINAL_PUNCTUATION);
  if (doubled) {
    issues.push({
      code: "double_terminal_punctuation",
      detail: "duplicated sentence-ending punctuation",
      match: doubled[0],
    });
  }

  const lowercaseStart = boundaryText.match(LOWERCASE_AFTER_PERIOD);
  if (lowercaseStart) {
    issues.push({
      code: "lowercase_after_period",
      detail: "a sentence starts with a lowercase word",
      match: lowercaseStart[0].trim(),
    });
  }

  const lastWord = lastWordOf(value);
  if (lastWord.length > 0 && TRAILING_PREPOSITIONS.has(lastWord)) {
    issues.push({
      code: "trailing_preposition",
      detail: "ends on a preposition or conjunction, so the thought does not close",
      match: lastWord,
    });
  }

  if (DANGLING_PUNCTUATION.test(value.trim())) {
    issues.push({
      code: "dangling_punctuation",
      detail: "ends on a comma, colon, semicolon, or dash",
    });
  }

  if (requireTerminal && !/[.!?…][)\]}"'”’]*$/u.test(value.trim())) {
    issues.push({
      code: "missing_terminal_punctuation",
      detail: "prose does not end in terminal punctuation",
    });
  }

  if (ZERO_WIDTH.test(value)) {
    issues.push({
      code: "zero_width_character",
      detail: "contains a zero-width or soft-hyphen character",
    });
  }

  const scriptCheckTarget = stripAllowedTerms(value, options.allowedTerms ?? []);
  const mixedScript = scriptCheckTarget.match(MIXED_SCRIPT_ADJACENT) ?? scriptCheckTarget.match(NON_LATIN_RUN);
  if (mixedScript) {
    issues.push({
      code: "mixed_script",
      detail: "mixes non-Latin script into English copy",
      match: mixedScript[0],
    });
  }

  for (const [pattern, detail] of THIRD_PERSON_STUDENT) {
    const found = value.match(pattern);
    if (found) {
      issues.push({ code: "third_person_student", detail, match: found[0] });
      break;
    }
  }

  for (const [pattern, detail] of INTERNAL_VOCABULARY) {
    const found = value.match(pattern);
    if (found) {
      issues.push({ code: "internal_vocabulary", detail, match: found[0] });
      break;
    }
  }

  const placeholder = value.match(TEMPLATE_PLACEHOLDER);
  if (placeholder) {
    issues.push({
      code: "template_placeholder",
      detail: "contains an unfilled template slot",
      match: placeholder[0],
    });
  }

  return issues;
}

/** True when `value` is safe to render as-is. */
export function isCleanProse(value: string, options: ContentLintOptions = {}): boolean {
  return lintProse(value, options).length === 0;
}

/** True when every string in `values` is clean. */
export function areCleanProse(values: readonly string[], options: ContentLintOptions = {}): boolean {
  return values.every((value) => isCleanProse(value, options));
}

export function formatLintIssues(issues: readonly ContentLintIssue[]): string {
  return issues
    .map((issue) => (issue.match ? `${issue.code} ("${issue.match}")` : issue.code))
    .join(", ");
}
