const RANGE_PATTERN = /(\d+)\s*(?:-|to)\s*(\d+)\s*(day|days|week|weeks)\b/i;
const SINGLE_PATTERN = /(?:about|around|roughly|approximately)?\s*(\d+)\s*(day|days|week|weeks)\b/i;

function unitToDays(unit: string) {
  return unit.toLowerCase().startsWith("week") ? 7 : 1;
}

export function parseRoughTimeEstimateDays(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const rangeMatch = normalized.match(RANGE_PATTERN);
  if (rangeMatch) {
    const upperBound = Number.parseInt(rangeMatch[2], 10);
    return upperBound * unitToDays(rangeMatch[3]);
  }

  const singleMatch = normalized.match(SINGLE_PATTERN);
  if (singleMatch) {
    const amount = Number.parseInt(singleMatch[1], 10);
    return amount * unitToDays(singleMatch[2]);
  }

  if (normalized.includes("few days")) {
    return 3;
  }

  if (normalized.includes("couple of days")) {
    return 2;
  }

  return null;
}

export function buildFallbackDurationDays(input: {
  estimatedWeeks: number;
  stepCount: number;
  weeklyHours?: number | null;
}) {
  const safeStepCount = Math.max(input.stepCount, 1);
  const safeWeeklyHours =
    typeof input.weeklyHours === "number" && Number.isFinite(input.weeklyHours) && input.weeklyHours > 0
      ? input.weeklyHours
      : 6;
  const availabilityMultiplier = safeWeeklyHours <= 4 ? 1.25 : safeWeeklyHours <= 6 ? 1.1 : 1;
  const totalDays = Math.ceil(input.estimatedWeeks * 7 * availabilityMultiplier);
  const basePerStep = Math.ceil(totalDays / safeStepCount);
  return Math.max(3, basePerStep);
}
