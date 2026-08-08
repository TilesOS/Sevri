// Content-quality checks for AI-generated text. Pure functions, no I/O.
// See src/lib/ai/content-quality.md for rationale and thresholds.

export type QualityIssueKind =
  | "mid_word_end"
  | "missing_terminal_punct"
  | "trailing_connector"
  | "dangling_colon_dash"
  | "language_contamination"
  | "mixed_script"
  | "zero_width"
  | "mojibake"
  | "unbalanced_pair"
  | "too_short"
  | "too_long"
  | "too_long_title"
  | "empty_or_whitespace";

export type QualityFieldKind = "title" | "prose" | "bullet" | "list_item";

export interface FieldSpec {
  kind: QualityFieldKind;
  minCredible?: number;
  /**
   * The schema's own length budget. Exceeding it is a repair signal sent back to
   * the model — content is never cut to fit, because a cut produces exactly the
   * mid-word artifacts this layer exists to prevent.
   */
  maxLength?: number;
  /** Width the UI is laid out for. Over-long values are clamped with CSS, never sliced. */
  maxUiSafe?: number;
  language?: "en";
}

export interface QualityIssue {
  path: string;
  kind: QualityIssueKind;
  detail: string;
  snippet?: string;
}

export interface ContentQualityReport {
  issues: QualityIssue[];
  severity: "clean" | "repairable" | "fatal";
}

export type FieldSpecMap = Record<string, FieldSpec>;

export interface CheckOptions {
  allowedTerms?: readonly string[];
}

const TRAILING_CONNECTORS = new Set([
  "and", "or", "the", "a", "an", "of", "with", "to", "for", "in", "on",
  "at", "by", "as", "but", "if", "than", "that", "which", "who", "whom",
  "is", "are", "was", "were", "be", "because", "so", "while", "when",
  "where", "from", "into", "onto", "nor", "yet", "although", "though",
  "about", "upon", "over", "under", "via", "per",
]);

const TERMINAL_PROSE_CHARS = new Set([".", "!", "?", "\u2026"]);
const CLOSING_WRAPPERS = new Set([")", "]", "}", "\"", "'", "\u201d", "\u2019"]);
const DANGLING_CHARS = new Set([":", ";", "-", "\u2014", "\u2013", ","]);

// Mojibake / UTF-8 double-encoding signatures.
// These only match obvious broken sequences; legitimate diacritics on their own are fine.
const MOJIBAKE_PATTERNS: RegExp[] = [
  /\uFFFD/u,
  /\u00C3[\u0081-\u00BF]/u,
  /\u00C2[\u0080-\u00BF]/u,
  /\u00E2\u0080[\u0080-\u00BF]/u,
  /\u00EF\u00BF\u00BD/u,
  /â€(™|œ|ž|¦|"|"|s|¢|¡)/u,
  /Ã[©¨ª¯®«¬½¾¢¥¶]/u,
  /[\u0080-\u009F]/u,
];

const NON_LATIN_SCRIPT_CLASS =
  "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Cyrillic}\\p{Script=Arabic}\\p{Script=Devanagari}\\p{Script=Hebrew}\\p{Script=Hangul}\\p{Script=Thai}\\p{Script=Bengali}\\p{Script=Tamil}\\p{Script=Gujarati}\\p{Script=Telugu}\\p{Script=Kannada}\\p{Script=Malayalam}\\p{Script=Gurmukhi}";

const NON_LATIN_SCRIPT_PATTERN = new RegExp(`[${NON_LATIN_SCRIPT_CLASS}]{2,}`, "u");

/**
 * A single non-Latin character fused to a Latin word — the "alias別" artifact.
 * A run of two is already caught above; this catches the one-character case that
 * slipped through, which is the shape the model actually produced.
 */
const MIXED_SCRIPT_PATTERN = new RegExp(
  `(?:[A-Za-z][${NON_LATIN_SCRIPT_CLASS}]|[${NON_LATIN_SCRIPT_CLASS}][A-Za-z])`,
  "u",
);

/** Zero-width and soft-hyphen characters. They defeat every end-of-string check below. */
const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\u2060\uFEFF\u00AD]/gu;

const URL_PATTERN = /https?:\/\/\S+/gu;
const CODE_SPAN_PATTERN = /`[^`]*`/gu;

function lastNonSpaceChar(text: string): string {
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    if (!/\s/u.test(char)) {
      return char;
    }
  }
  return "";
}

function lastWord(text: string): string {
  const trimmed = text.replace(/[\s]+$/u, "");
  const match = trimmed.match(/([A-Za-z\u2019']+)[^A-Za-z\u2019']*$/u);
  return match ? match[1] : "";
}

function endsWithTerminalPunct(text: string): boolean {
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    if (/\s/u.test(char)) continue;
    if (CLOSING_WRAPPERS.has(char)) continue;
    return TERMINAL_PROSE_CHARS.has(char);
  }
  return false;
}

function endsMidWord(text: string): boolean {
  const trimmed = text.replace(/\s+$/u, "");
  if (trimmed.length === 0) return false;
  const last = trimmed[trimmed.length - 1];
  if (last === "-" || last === "\u2014" || last === "\u2013") {
    // Trailing dash with no following char → likely hyphenation cut
    // But "em-dash as sentence pause" is a separate signal (dangling_colon_dash).
    // Only flag mid_word_end when the dash immediately follows a letter.
    const prev = trimmed[trimmed.length - 2];
    return prev !== undefined && /[A-Za-z]/u.test(prev);
  }
  return false;
}

function endsWithConnector(text: string): boolean {
  const word = lastWord(text).toLowerCase();
  return word.length > 0 && TRAILING_CONNECTORS.has(word);
}

function endsWithDangling(text: string): boolean {
  const ch = lastNonSpaceChar(text);
  return DANGLING_CHARS.has(ch);
}

function stripForLanguageCheck(text: string, allowed: readonly string[]): string {
  let stripped = text.replace(URL_PATTERN, " ").replace(CODE_SPAN_PATTERN, " ");
  for (const term of allowed) {
    if (!term) continue;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    stripped = stripped.replace(new RegExp(escaped, "giu"), " ");
  }
  return stripped;
}

function hasLanguageContamination(text: string, allowed: readonly string[]): boolean {
  const stripped = stripForLanguageCheck(text, allowed);
  return NON_LATIN_SCRIPT_PATTERN.test(stripped);
}

function hasMojibake(text: string): boolean {
  return MOJIBAKE_PATTERNS.some((pattern) => pattern.test(text));
}

function hasZeroWidth(text: string): boolean {
  ZERO_WIDTH_PATTERN.lastIndex = 0;
  return ZERO_WIDTH_PATTERN.test(text);
}

function stripZeroWidth(text: string): string {
  return text.replace(ZERO_WIDTH_PATTERN, "");
}

function hasMixedScript(text: string, allowed: readonly string[]): boolean {
  return MIXED_SCRIPT_PATTERN.test(stripForLanguageCheck(text, allowed));
}

function countUnbalancedPairs(text: string): number {
  let unbalanced = 0;

  // Parentheses/brackets/braces
  const pairs: Array<[string, string]> = [["(", ")"], ["[", "]"], ["{", "}"]];
  for (const [open, close] of pairs) {
    const opens = (text.match(new RegExp(`\\${open}`, "gu")) ?? []).length;
    const closes = (text.match(new RegExp(`\\${close}`, "gu")) ?? []).length;
    if (opens !== closes) unbalanced += 1;
  }

  // Straight double quotes — must be even
  const doubleQuotes = (text.match(/"/gu) ?? []).length;
  if (doubleQuotes % 2 !== 0) unbalanced += 1;

  // Smart double quotes — opens must equal closes
  const smartOpen = (text.match(/\u201c/gu) ?? []).length;
  const smartClose = (text.match(/\u201d/gu) ?? []).length;
  if (smartOpen !== smartClose) unbalanced += 1;

  return unbalanced;
}

function snippetOf(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= 40) return trimmed;
  return `...${trimmed.slice(-40)}`;
}

function requiresTerminalPunct(kind: QualityFieldKind): boolean {
  return kind === "prose" || kind === "bullet";
}

export function checkField(
  rawValue: unknown,
  path: string,
  spec: FieldSpec,
  options: CheckOptions = {},
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  if (typeof rawValue !== "string") {
    return issues;
  }

  const rawTrimmed = rawValue.trim();
  if (rawTrimmed.length === 0) {
    issues.push({ path, kind: "empty_or_whitespace", detail: "field is empty or whitespace-only" });
    return issues;
  }

  if (hasZeroWidth(rawValue)) {
    issues.push({
      path,
      kind: "zero_width",
      detail: "contains zero-width or soft-hyphen characters",
      snippet: snippetOf(rawValue),
    });
  }

  // Every check below reads the end of the string, so the invisible characters
  // have to come off first or a truncated field looks correctly terminated.
  const value = stripZeroWidth(rawValue);
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    issues.push({ path, kind: "empty_or_whitespace", detail: "field is only invisible characters" });
    return issues;
  }

  if (hasMojibake(value)) {
    issues.push({
      path,
      kind: "mojibake",
      detail: "contains broken UTF-8 / replacement-character artifacts",
      snippet: snippetOf(value),
    });
  }

  const allowedTerms = options.allowedTerms ?? [];
  if ((spec.language ?? "en") === "en" && hasLanguageContamination(value, allowedTerms)) {
    issues.push({
      path,
      kind: "language_contamination",
      detail: "contains non-Latin script fragments in an English field",
      snippet: snippetOf(value),
    });
  } else if ((spec.language ?? "en") === "en" && hasMixedScript(value, allowedTerms)) {
    issues.push({
      path,
      kind: "mixed_script",
      detail: "fuses a non-Latin character onto an English word",
      snippet: snippetOf(value),
    });
  }

  if (countUnbalancedPairs(value) > 0) {
    issues.push({
      path,
      kind: "unbalanced_pair",
      detail: "has unmatched quote, bracket, or parenthesis",
      snippet: snippetOf(value),
    });
  }

  if (endsMidWord(value)) {
    issues.push({
      path,
      kind: "mid_word_end",
      detail: "ends mid-word (trailing hyphen suggests truncation)",
      snippet: snippetOf(value),
    });
  }

  if (endsWithDangling(value)) {
    issues.push({
      path,
      kind: "dangling_colon_dash",
      detail: "ends with a dangling colon, comma, semicolon, or dash",
      snippet: snippetOf(value),
    });
  }

  if (endsWithConnector(value)) {
    issues.push({
      path,
      kind: "trailing_connector",
      detail: "ends on a preposition or conjunction — likely truncation or awkward stop",
      snippet: snippetOf(value),
    });
  }

  if (requiresTerminalPunct(spec.kind) && !endsWithTerminalPunct(value)) {
    issues.push({
      path,
      kind: "missing_terminal_punct",
      detail: "prose field does not end in terminal punctuation",
      snippet: snippetOf(value),
    });
  }

  if (spec.minCredible !== undefined && trimmed.length < spec.minCredible) {
    issues.push({
      path,
      kind: "too_short",
      detail: `field is ${trimmed.length} chars, expected at least ${spec.minCredible}`,
      snippet: snippetOf(value),
    });
  }

  // Over-length is reported so the model rewrites the field shorter but complete.
  // Nothing downstream cuts the value to fit.
  if (spec.maxLength !== undefined && trimmed.length > spec.maxLength) {
    issues.push({
      path,
      kind: "too_long",
      detail: `field is ${trimmed.length} chars, budget is ${spec.maxLength} — rewrite it shorter, do not cut it`,
      snippet: snippetOf(value),
    });
  }

  if (spec.kind === "title" && spec.maxUiSafe !== undefined && trimmed.length > spec.maxUiSafe) {
    issues.push({
      path,
      kind: "too_long_title",
      detail: `title is ${trimmed.length} chars, UI budget is ${spec.maxUiSafe} — write a shorter complete title`,
      snippet: snippetOf(value),
    });
  }

  return issues;
}

function pathMatches(pattern: string, concretePath: string): boolean {
  if (pattern === concretePath) return true;
  if (!pattern.includes("[*]")) return false;
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\*]/gu, "\\$&")
    .replace(/\\\[\\\*\\\]/gu, "\\[\\d+\\]");
  return new RegExp(`^${escaped}$`).test(concretePath);
}

function lookupSpec(specs: FieldSpecMap, concretePath: string): FieldSpec | undefined {
  const direct = specs[concretePath];
  if (direct) return direct;
  for (const pattern of Object.keys(specs)) {
    if (pattern.includes("[*]") && pathMatches(pattern, concretePath)) {
      return specs[pattern];
    }
  }
  return undefined;
}

export function getFieldSpecForPath(
  specs: FieldSpecMap,
  concretePath: string,
): FieldSpec | undefined {
  return lookupSpec(specs, concretePath);
}

function walkStrings(
  node: unknown,
  path: string,
  visit: (value: string, path: string) => void,
): void {
  if (node === null || node === undefined) return;
  if (typeof node === "string") {
    visit(node, path);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((child, index) => walkStrings(child, `${path}[${index}]`, visit));
    return;
  }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      const nextPath = path.length === 0 ? key : `${path}.${key}`;
      walkStrings(value, nextPath, visit);
    }
  }
}

const FATAL_KINDS: ReadonlySet<QualityIssueKind> = new Set([
  "mojibake",
  "unbalanced_pair",
  "mixed_script",
  "language_contamination",
]);

export function checkStructured(
  parsed: unknown,
  specs: FieldSpecMap,
  options: CheckOptions = {},
): ContentQualityReport {
  const issues: QualityIssue[] = [];
  walkStrings(parsed, "", (value, path) => {
    const spec = lookupSpec(specs, path);
    if (!spec) return;
    issues.push(...checkField(value, path, spec, options));
  });

  const severity: ContentQualityReport["severity"] =
    issues.length === 0
      ? "clean"
      : issues.some((issue) => FATAL_KINDS.has(issue.kind))
        ? "fatal"
        : "repairable";

  return { issues, severity };
}

/** What the model should do about each issue kind, in its own words. */
const REPAIR_INSTRUCTIONS: Record<QualityIssueKind, string> = {
  mid_word_end: "it stops mid-word — write the whole word",
  missing_terminal_punct: "it does not end in terminal punctuation — finish the sentence",
  trailing_connector: "it ends on a preposition or conjunction — finish the thought",
  dangling_colon_dash: "it ends on a comma, colon, semicolon, or dash — finish the thought",
  language_contamination: "it contains non-English script — write in English only",
  mixed_script: "it fuses a non-Latin character onto an English word — remove it",
  zero_width: "it contains invisible zero-width characters — remove them",
  mojibake: "it contains broken characters — rewrite it cleanly",
  unbalanced_pair: "it has an unmatched quote, bracket, or parenthesis — close it",
  too_short: "it is too short to be useful — write a fuller version",
  too_long:
    "it exceeds its length budget — write a SHORTER but COMPLETE version, never a cut-off one",
  too_long_title:
    "the title is too long for the layout — write a shorter complete title, never a cut-off one",
  empty_or_whitespace: "it is empty — write real content",
};

export function buildRepairFeedback(report: ContentQualityReport): string[] {
  if (report.issues.length === 0) return [];
  const grouped = new Map<string, QualityIssueKind[]>();
  for (const issue of report.issues) {
    const kinds = grouped.get(issue.path) ?? [];
    if (!kinds.includes(issue.kind)) kinds.push(issue.kind);
    grouped.set(issue.path, kinds);
  }

  const lines: string[] = [];
  for (const [path, kinds] of grouped) {
    const instructions = kinds.map((kind) => REPAIR_INSTRUCTIONS[kind]).join("; ");
    lines.push(
      `Field "${path}": ${instructions}. Rewrite the whole field as one complete thought in English.`,
    );
  }

  return lines;
}

// Strip mojibake sequences (best-effort) before further cleanup.
function stripMojibake(text: string): string {
  let out = text;
  for (const pattern of MOJIBAKE_PATTERNS) {
    out = out.replace(new RegExp(pattern.source, "gu"), "");
  }
  return out;
}

function trimDangling(text: string): string {
  let out = text.replace(/\s+$/u, "");
  while (out.length > 0) {
    const last = out[out.length - 1];
    if (DANGLING_CHARS.has(last)) {
      out = out.slice(0, -1).replace(/\s+$/u, "");
      continue;
    }
    break;
  }
  return out;
}

function stripTrailingConnector(text: string): string {
  const word = lastWord(text).toLowerCase();
  if (!word || !TRAILING_CONNECTORS.has(word)) return text;
  const idx = text.toLowerCase().lastIndexOf(word);
  if (idx < 0) return text;
  return text.slice(0, idx).replace(/\s+$/u, "");
}

function truncateToLastSentence(text: string): { text: string; changed: boolean } {
  const match = text.match(/^([\s\S]*[.!?\u2026])(?:[\s\u201d\u2019"')\]}]*)$/u);
  if (match) {
    return { text: match[1].trim(), changed: match[1].trim() !== text.trim() };
  }
  // Find the last terminal-punct occurrence and cut there.
  let cut = -1;
  for (let i = text.length - 1; i >= 0; i--) {
    if (TERMINAL_PROSE_CHARS.has(text[i])) {
      cut = i;
      break;
    }
  }
  if (cut < 0) return { text, changed: false };
  return { text: text.slice(0, cut + 1).trim(), changed: true };
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

function setAtPath(root: unknown, path: string, value: string): void {
  // Path tokens: either ".key" or "[index]". Start with leading key.
  const tokens: Array<{ kind: "key" | "index"; value: string }> = [];
  const re = /([^.[\]]+)|\[(\d+)\]/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path)) !== null) {
    if (match[1] !== undefined) tokens.push({ kind: "key", value: match[1] });
    else if (match[2] !== undefined) tokens.push({ kind: "index", value: match[2] });
  }
  if (tokens.length === 0) return;

  let node: unknown = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i];
    if (token.kind === "key" && node && typeof node === "object" && !Array.isArray(node)) {
      node = (node as Record<string, unknown>)[token.value];
    } else if (token.kind === "index" && Array.isArray(node)) {
      node = node[Number(token.value)];
    } else {
      return;
    }
  }
  const last = tokens[tokens.length - 1];
  if (last.kind === "key" && node && typeof node === "object" && !Array.isArray(node)) {
    (node as Record<string, unknown>)[last.value] = value;
  } else if (last.kind === "index" && Array.isArray(node)) {
    node[Number(last.value)] = value;
  }
}

/**
 * Walks `parsed` and applies `safeRenderText` to every string field that has a
 * matching spec. Returns a new object with cleaned values and the set of paths
 * that were actually changed. Intended as the tier-3 deterministic fallback.
 */
export function applyStructuredCleanup<T>(
  parsed: T,
  specs: FieldSpecMap,
): { cleaned: T; changedPaths: string[] } {
  const cleaned = cloneValue(parsed);
  const changedPaths: string[] = [];
  walkStrings(cleaned, "", (value, path) => {
    const spec = lookupSpec(specs, path);
    if (!spec) return;
    const result = safeRenderText(value, spec);
    if (result.degraded && result.text !== value) {
      setAtPath(cleaned as unknown, path, result.text);
      changedPaths.push(path);
    }
  });
  return { cleaned, changedPaths };
}

export function safeRenderText(
  rawValue: string,
  spec: FieldSpec,
): { text: string; degraded: boolean } {
  if (typeof rawValue !== "string") {
    return { text: "", degraded: true };
  }

  let text = rawValue;
  let degraded = false;

  if (hasZeroWidth(text)) {
    text = stripZeroWidth(text);
    degraded = true;
  }

  if (hasMojibake(text)) {
    text = stripMojibake(text);
    degraded = true;
  }

  // Collapse runs of whitespace but keep content otherwise.
  const collapsed = text.replace(/[ \t]+/gu, " ").trim();
  if (collapsed !== text.trim()) {
    text = collapsed;
  } else {
    text = text.trim();
  }

  // Drop trailing hyphens that indicate mid-word truncation.
  if (endsMidWord(text)) {
    text = text.replace(/[-\u2013\u2014]+\s*$/u, "").trim();
    degraded = true;
  }

  if (endsWithDangling(text)) {
    text = trimDangling(text);
    degraded = true;
  }

  if (endsWithConnector(text)) {
    text = stripTrailingConnector(text);
    degraded = true;
  }

  if (requiresTerminalPunct(spec.kind)) {
    if (!endsWithTerminalPunct(text)) {
      const snapped = truncateToLastSentence(text);
      if (snapped.changed && snapped.text.length > 0) {
        text = snapped.text;
        degraded = true;
      } else if (text.length > 0) {
        // No sentence boundary found — append a period to close the phrase.
        // The hyphen is escaped: unescaped it forms a ":" to en-dash range, which
        // swallows letters and turned "\u2026the study" into "\u2026the".
        text = `${text.replace(/[,;:\-\u2013\u2014]+$/u, "").trim()}.`;
        degraded = true;
      }
    }
  }

  // A long title is returned in full. Cutting it here is what produced titles
  // like "...waveguides to identify underexploit"; the UI clamps with CSS instead.
  return { text, degraded };
}
