/**
 * The boundary between internal error strings and what a student reads.
 *
 * Messages from Supabase, our own route handlers, and the rate limiter are
 * written for engineers ("Rate limit exceeded", "Invalid login credentials").
 * Anything rendered to a user goes through here first, so the app never shows
 * a raw internal string and every message says what to do next.
 */

/** Copy for a rate limit the user just tripped. Never says "rate limit". */
export const RATE_LIMITED_MESSAGE =
  "You're moving fast — try again in about a minute. Nothing you've saved is affected.";

const EXACT_MATCHES: Record<string, string> = {
  "rate limit exceeded": RATE_LIMITED_MESSAGE,
  "too many requests": RATE_LIMITED_MESSAGE,
  "invalid login credentials": "That email and password don't match. Check both and try again.",
  "email not confirmed": "Confirm your email address first — check your inbox for the link we sent.",
  "user already registered": "An account already exists for that email. Sign in instead, or reset your password.",
  "invalid email or password": "That email and password don't match. Check both and try again.",
  "email rate limit exceeded":
    "Too many emails have gone out to this address recently. Try again in a few minutes.",
  "failed to fetch": "We couldn't reach Sevri. Check your connection and try again.",
  "network error": "We couldn't reach Sevri. Check your connection and try again.",
  "load failed": "We couldn't reach Sevri. Check your connection and try again.",
};

/**
 * Rules for messages that carry variable detail. Ordered — first match wins.
 *
 * `message` replaces the whole string. `rewrite` is a String.replace template
 * (so `$1` keeps a captured number). `internal` means the string is diagnostic
 * and the caller's contextual fallback is the better answer.
 */
type PatternRule =
  | { pattern: RegExp; message: string }
  | { pattern: RegExp; rewrite: string }
  | { pattern: RegExp; internal: true };

const PATTERN_RULES: ReadonlyArray<PatternRule> = [
  { pattern: /rate.?limit/i, message: RATE_LIMITED_MESSAGE },
  {
    pattern: /password should be at least (\d+)\s*characters?\.?/i,
    rewrite: "Choose a password with at least $1 characters.",
  },
  {
    pattern: /email address .* is invalid|unable to validate email/i,
    message: "That email address doesn't look right. Check it and try again.",
  },
  {
    pattern: /for security purposes, you can only request this after (\d+) seconds/i,
    rewrite: "Give it $1 seconds, then try again.",
  },
  {
    pattern: /\bjwt\b|token .*expired|session .*expired|refresh_token/i,
    message: "Your session expired. Sign in again to continue.",
  },
  {
    pattern: /supabase|postgres|pgrst|violates .* (?:constraint|policy)|relation .* does not exist|duplicate key/i,
    internal: true,
  },
];

/**
 * Maps a raw error message to copy a student can act on.
 *
 * `fallback` is used when the raw message is missing, empty, or looks like
 * internal machinery rather than a sentence written for a person.
 */
export function toUserFacingError(raw: unknown, fallback: string): string {
  const message = typeof raw === "string" ? raw.trim() : raw instanceof Error ? raw.message.trim() : "";

  if (message.length === 0) {
    return fallback;
  }

  const exact = EXACT_MATCHES[message.toLowerCase()];
  if (exact) {
    return exact;
  }

  for (const rule of PATTERN_RULES) {
    if (!rule.pattern.test(message)) {
      continue;
    }

    if ("internal" in rule) {
      return fallback;
    }

    // A whole-string replacement never splices copy into the raw text; only an
    // explicit `rewrite` keeps surrounding detail.
    return "message" in rule ? rule.message : message.replace(rule.pattern, rule.rewrite);
  }

  return looksInternal(message) ? fallback : message;
}

/**
 * True for strings that read like diagnostics rather than guidance: stack-ish
 * text, identifiers, error codes, or anything without sentence shape.
 */
function looksInternal(message: string): boolean {
  if (message.length > 240) return true;
  if (/\bat\s+\w+\s+\(/.test(message)) return true;
  if (/^[A-Z_]+$/.test(message)) return true;
  if (/^[a-z0-9_]+$/.test(message) && message.includes("_")) return true;
  if (/\b(?:undefined|null|NaN|\[object Object\])\b/.test(message)) return true;
  if (/^\s*[{[]/.test(message)) return true;
  if (/https?:\/\/[^\s]*(?:supabase|openai|stripe)/i.test(message)) return true;

  // Sentence-shaped copy starts with a capital and contains a space.
  return !/^[A-Z"']/.test(message) || !message.includes(" ");
}

/** True when a response signals a rate limit, by status or by body code. */
export function isRateLimited(status: number, code?: string | null): boolean {
  return status === 429 || code === "rate_limited";
}
