import { toUserFacingError } from "@/lib/errors/user-messages";

/**
 * Supabase/provider messages are implementation details. Known messages are
 * translated by `toUserFacingError`; unknown raw strings use contextual copy.
 */
export function toUserFacingAuthError(error: unknown, fallback: string) {
  const translated = toUserFacingError(error, fallback);
  const raw =
    typeof error === "string" ? error.trim() : error instanceof Error ? error.message.trim() : "";

  return raw && translated === raw ? fallback : translated;
}
