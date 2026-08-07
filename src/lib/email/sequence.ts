const DAY_MS = 24 * 60 * 60 * 1000;

export function elapsedDays(from: string | Date, now: Date = new Date()) {
  const startedAt = from instanceof Date ? from : new Date(from);
  return Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / DAY_MS));
}

export function activationStage(days: number, sent: Set<3 | 7>): 3 | 7 | null {
  if (days >= 3 && !sent.has(3)) return 3;
  if (days >= 7 && sent.has(3) && !sent.has(7)) return 7;
  return null;
}

export function inactivityStage(days: number, sent: Set<7 | 14>): 7 | 14 | null {
  if (days >= 14 && sent.has(7) && !sent.has(14)) return 14;
  if (days >= 7 && !sent.has(7)) return 7;
  return null;
}

export function activityCycleKey(activityAt: string) {
  return new Date(activityAt).toISOString().replace(/[:.]/g, "-");
}
