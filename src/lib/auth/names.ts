interface NameSourceInput {
  profileFullName?: unknown;
  userMetadata?: Record<string, unknown> | null | undefined;
  email?: string | null | undefined;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length >= 2 ? normalized : null;
}

function getUserMetadataNameCandidate(userMetadata?: Record<string, unknown> | null) {
  if (!userMetadata) {
    return null;
  }

  return (
    cleanName(userMetadata.full_name) ??
    cleanName(userMetadata.name) ??
    cleanName(userMetadata.user_name) ??
    cleanName(userMetadata.preferred_username) ??
    cleanName(userMetadata.login)
  );
}

function emailFallback(email?: string | null) {
  if (!email) {
    return "Sevri Student";
  }

  const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!localPart) {
    return email;
  }

  const titled = localPart
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return titled || email;
}

export function getUserMetadataFullName(userMetadata?: Record<string, unknown> | null) {
  return getUserMetadataNameCandidate(userMetadata);
}

export function resolveStoredFullName(input: NameSourceInput) {
  return (
    cleanName(input.profileFullName) ??
    getUserMetadataNameCandidate(input.userMetadata) ??
    emailFallback(input.email)
  );
}

export function resolveDisplayName(input: NameSourceInput) {
  return (
    cleanName(input.profileFullName) ??
    getUserMetadataNameCandidate(input.userMetadata) ??
    emailFallback(input.email)
  );
}
