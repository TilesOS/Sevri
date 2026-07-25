// Shared prose primitives for composing user-visible copy out of stored fields.
//
// The rule these helpers exist to enforce: a stored generated field is never
// pasted into the middle of a hand-written sentence. Model fields are prose of
// unpredictable shape (they may end in "?", contain two sentences, or start with
// a capital), so slotting them mid-sentence is what produced artifacts like
// ". and", "? with", and "a focused way to the app walks the user through...".
//
// Pure functions, no I/O.

/** Zero-width and soft-hyphen characters that survive copy/paste and break end-of-string checks. */
const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\u2060\uFEFF\u00AD]/gu;

const TERMINAL_PUNCTUATION = new Set([".", "!", "?", "…"]);

/** Trailing punctuation that should be shed before a field is reused. */
const TRAILING_PUNCTUATION_PATTERN = /[.!?…,;:\s]+$/u;

/**
 * Words that are already capitalized for a reason (acronyms, proper nouns) and
 * must not be lowercased when a field is reused as an inline phrase.
 */
function isIntentionallyCapitalized(word: string): boolean {
  const bare = word.replace(/[^A-Za-z0-9+#.]/gu, "");
  if (bare.length === 0) return false;
  // All-caps tokens longer than one character: API, MVP, RTL, CI.
  if (bare.length > 1 && bare === bare.toUpperCase() && /[A-Z]/u.test(bare)) return true;
  // Internal capitals: TypeScript, PyTorch, GitHub, arXiv.
  if (/[a-z][A-Z]/u.test(bare)) return true;
  return false;
}

export function stripZeroWidth(value: string): string {
  return value.replace(ZERO_WIDTH_PATTERN, "");
}

export function normalizeWhitespace(value: string): string {
  return stripZeroWidth(value).replace(/\s+/gu, " ").trim();
}

export function hasZeroWidth(value: string): boolean {
  ZERO_WIDTH_PATTERN.lastIndex = 0;
  return ZERO_WIDTH_PATTERN.test(value);
}

export function stripTerminalPunctuation(value: string): string {
  return normalizeWhitespace(value).replace(TRAILING_PUNCTUATION_PATTERN, "");
}

export function endsWithTerminalPunctuation(value: string): boolean {
  const normalized = normalizeWhitespace(value);
  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    const char = normalized[i];
    if (/[)\]}"'”’]/u.test(char)) continue;
    return TERMINAL_PUNCTUATION.has(char);
  }
  return false;
}

/** The first sentence of `value`, including its terminal punctuation. */
export function firstSentence(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) return "";
  const match = normalized.match(/^(.*?[.!?…])(?:\s|$)/u);
  return match ? match[1] : normalized;
}

export function sentenceCount(value: string): number {
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) return 0;
  const matches = normalized.match(/[.!?…]+(?:\s|$)/gu);
  return matches ? matches.length : 1;
}

export function capitalizeFirst(value: string): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) return "";
  return normalized[0].toUpperCase() + normalized.slice(1);
}

/**
 * Renders `value` as a standalone sentence: normalized, capitalized, and closed
 * with terminal punctuation. Safe for any stored field, however it was written.
 */
export function asSentence(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) return "";
  const capitalized = capitalizeFirst(normalized);
  if (endsWithTerminalPunctuation(capitalized)) {
    return capitalized;
  }
  // Shed a dangling connector-ish tail character before closing the sentence.
  return `${capitalized.replace(/[,;:\-–—]+$/u, "").trimEnd()}.`;
}

/** Maximum length for a field reused inline rather than as its own sentence. */
const INLINE_PHRASE_MAX_CHARS = 90;

/**
 * Renders `value` as a lowercase noun phrase for inline use, or returns `null`
 * when the source is too long or too sentence-shaped to inline safely. Callers
 * must handle `null` by giving the field its own sentence instead.
 */
export function asInlinePhrase(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeWhitespace(value);
  if (normalized.length === 0) return null;
  if (sentenceCount(normalized) > 1) return null;

  const phrase = stripTerminalPunctuation(normalized);
  if (phrase.length === 0 || phrase.length > INLINE_PHRASE_MAX_CHARS) return null;

  const [firstWord, ...rest] = phrase.split(" ");
  if (isIntentionallyCapitalized(firstWord)) {
    return [firstWord, ...rest].join(" ");
  }
  return [firstWord.charAt(0).toLowerCase() + firstWord.slice(1), ...rest].join(" ");
}

/**
 * Renders `value` as an inline phrase, falling back to `fallback` when the
 * source cannot be inlined safely.
 */
export function inlinePhraseOr(value: string | null | undefined, fallback: string): string {
  return asInlinePhrase(value) ?? fallback;
}

/** Joins parts into one paragraph, rendering each part as a complete sentence. */
export function joinSentences(...parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => asSentence(part))
    .filter((part) => part.length > 0)
    .join(" ");
}

/**
 * Composes a "Label: sentence" line. The body always occupies its own sentence,
 * so a body that ends in "?" or spans two sentences still reads correctly.
 */
export function labeledSentence(label: string, body: string): string {
  const cleanLabel = stripTerminalPunctuation(label);
  const cleanBody = asSentence(body);
  if (cleanLabel.length === 0) return cleanBody;
  if (cleanBody.length === 0) return "";
  return `${capitalizeFirst(cleanLabel)}: ${cleanBody}`;
}
