export const DEFAULT_AUTH_REDIRECT = "/dashboard";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function hasUnsafeRedirectSyntax(value: string) {
  return (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    CONTROL_CHARACTERS.test(value)
  );
}

/**
 * Accepts only same-origin application paths. The decoded checks catch values
 * such as `/%2f%2fevil.example` and encoded backslashes before a router or URL
 * implementation has a chance to normalize them.
 */
export function isSafeRedirectPath(value: string | null | undefined): value is string {
  if (!value || hasUnsafeRedirectSyntax(value)) {
    return false;
  }

  let decoded = value;

  try {
    for (let depth = 0; depth < 3; depth += 1) {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) {
        break;
      }

      decoded = nextDecoded;
      if (hasUnsafeRedirectSyntax(decoded)) {
        return false;
      }
    }

    const baseUrl = new URL("https://sevri.invalid");
    return new URL(value, baseUrl).origin === baseUrl.origin;
  } catch {
    return false;
  }
}

export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
) {
  return isSafeRedirectPath(value) ? value : fallback;
}
