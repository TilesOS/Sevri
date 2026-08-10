// Rewrites third-person, pipeline-facing prose into copy addressed to the student.
//
// Two sources need this. The normalizer's `summary` is written by the model and
// is surfaced on the idea board as the authenticity note, and older stored rows
// were composed before second-person voice was a requirement. Both can say
// "The student can handle..." or "Sevri's target outcome"; the reader is the
// student, so the copy must say "you" and must not name internal fields.
//
// Pure functions, no I/O.

import { capitalizeFirst, normalizeWhitespace } from "./prose.ts";

interface VoiceRule {
  pattern: RegExp;
  replacement: string;
  /** True when the rule proves the sentence is talking about the reader. */
  identifiesReader?: boolean;
}

/** "You needs" and friends: subject changed to "you", verb still agrees with "the student". */
const READER_VERB_AGREEMENT = [
  ["is", "are"],
  ["was", "were"],
  ["has", "have"],
  ["does", "do"],
  ["needs", "need"],
  ["wants", "want"],
  ["prefers", "prefer"],
  ["brings", "bring"],
  ["knows", "know"],
  ["holds", "hold"],
  ["keeps", "keep"],
  ["owns", "own"],
  ["gets", "get"],
  ["makes", "make"],
  ["takes", "take"],
  ["shows", "show"],
  ["works", "work"],
  ["handles", "handle"],
  ["stays", "stay"],
  ["defends", "defend"],
  ["completes", "complete"],
  ["plans", "plan"],
  ["builds", "build"],
  ["writes", "write"],
  ["gives", "give"],
  ["lets", "let"],
  ["helps", "help"],
  ["means", "mean"],
  ["uses", "use"],
  ["runs", "run"],
  ["ships", "ship"],
  ["picks", "pick"],
  ["chooses", "choose"],
] as const;

/**
 * Applied in order. Longer, more specific phrasings come first so that a generic
 * rule does not strand a partially rewritten clause.
 */
const VOICE_RULES: VoiceRule[] = [
  // Internal vocabulary — replaced before pronouns so the rewrites read cleanly.
  { pattern: /\bSevri's target outcome\b/giu, replacement: "your goal" },
  { pattern: /\bthe target outcome\b/giu, replacement: "your goal" },
  { pattern: /\bSevri's\b/gu, replacement: "your" },
  { pattern: /\bThe (?:normalized )?profile is optimized for\b/gu, replacement: "This plan is set up for" },
  { pattern: /\bthe (?:normalized )?profile is optimized for\b/gu, replacement: "this plan is set up for" },
  { pattern: /\bThe (?:normalized )?profile\b/gu, replacement: "This plan" },
  { pattern: /\bthe (?:normalized )?profile\b/gu, replacement: "this plan" },
  { pattern: /\b(?:the )?anchor interests\b/giu, replacement: "your main interests" },

  // Possessives and subjects — most specific first.
  {
    pattern: /\bThe student's\b/gu,
    replacement: "Your",
    identifiesReader: true,
  },
  {
    pattern: /\bthe student's\b/gu,
    replacement: "your",
    identifiesReader: true,
  },
  {
    pattern: /\bThe students'\b/gu,
    replacement: "Your",
    identifiesReader: true,
  },
  {
    pattern: /\bThe student can\b/gu,
    replacement: "You can",
    identifiesReader: true,
  },
  {
    pattern: /\bthe student can\b/gu,
    replacement: "you can",
    identifiesReader: true,
  },
  {
    pattern: /\bThe student will\b/gu,
    replacement: "You will",
    identifiesReader: true,
  },
  {
    pattern: /\bthe student will\b/gu,
    replacement: "you will",
    identifiesReader: true,
  },
  {
    pattern: /\bThe student\b/gu,
    replacement: "You",
    identifiesReader: true,
  },
  {
    pattern: /\bthe student\b/gu,
    replacement: "you",
    identifiesReader: true,
  },
  {
    pattern: /\bThis student\b/gu,
    replacement: "You",
    identifiesReader: true,
  },
  {
    pattern: /\bthis student\b/gu,
    replacement: "you",
    identifiesReader: true,
  },
];

/**
 * Verb agreement fixes for clauses whose subject became "you". Applied only when
 * a reader-identifying rule fired, so unrelated third-person prose is untouched.
 */
const AGREEMENT_RULES: Array<[RegExp, string]> = READER_VERB_AGREEMENT.map(
  ([singular, plural]): [RegExp, string] => [
    new RegExp(`\\b(you)\\s+${singular}\\b`, "giu"),
    `$1 ${plural}`,
  ],
);

/**
 * Third-person pronouns rewritten only once the text is known to be about the
 * reader — otherwise "their" could belong to a legitimate third party such as
 * the project's target users.
 */
const READER_PRONOUN_RULES: Array<[RegExp, string]> = [
  [/\btheirs\b/gu, "yours"],
  [/\bTheirs\b/gu, "Yours"],
  [/\btheir\b/gu, "your"],
  [/\bTheir\b/gu, "Your"],
  [/\bthemselves\b/gu, "yourself"],
  [/\bThemselves\b/gu, "Yourself"],
  // "they" is already plural, so no verb-agreement fix is needed after this.
  [/\bthey\b/gu, "you"],
  [/\bThey\b/gu, "You"],
  [/\bthem\b/gu, "you"],
  [/\bThem\b/gu, "You"],
];

function recapitalizeSentences(value: string): string {
  return value.replace(/(^|[.!?…]\s+)([a-z])/gu, (_match, prefix: string, letter: string) =>
    `${prefix}${letter.toUpperCase()}`,
  );
}

/**
 * Rewrites `value` so it addresses the student directly and carries no internal
 * profile vocabulary. Text that is already in second person is returned
 * unchanged apart from whitespace normalization.
 */
export function toStudentVoice(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  let out = normalizeWhitespace(value);
  if (out.length === 0) return "";

  let identifiesReader = false;
  for (const rule of VOICE_RULES) {
    // The patterns are global, so lastIndex is reset around every probe.
    rule.pattern.lastIndex = 0;
    const matched = rule.pattern.test(out);
    rule.pattern.lastIndex = 0;
    if (!matched) continue;

    out = out.replace(rule.pattern, rule.replacement);
    if (rule.identifiesReader) {
      identifiesReader = true;
    }
  }

  if (identifiesReader) {
    for (const [pattern, replacement] of READER_PRONOUN_RULES) {
      out = out.replace(pattern, replacement);
    }
    for (const [pattern, replacement] of AGREEMENT_RULES) {
      out = out.replace(pattern, replacement);
    }
  }

  out = normalizeWhitespace(out);
  out = recapitalizeSentences(out);
  return capitalizeFirst(out);
}

/** True when `value` reads as third-person or pipeline-facing copy. */
export function needsStudentVoice(value: string | null | undefined): boolean {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  return toStudentVoice(value) !== normalizeWhitespace(value);
}
