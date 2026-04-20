const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function getUtcDateParts(value: string) {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`Invalid date string: ${value}`);
  }

  const [yearPart, monthPart, dayPart] = value.split("-");
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid date string: ${value}`);
  }

  return { year, month, day };
}

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function isDateString(value: string | null | undefined): value is string {
  return typeof value === "string" && DATE_PATTERN.test(value);
}

export function normalizeTimeZone(value: string | null | undefined) {
  if (!value) {
    return "UTC";
  }

  try {
    getFormatter(value).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

export function getTodayDateString(timeZone: string, referenceDate = new Date()) {
  const formatter = getFormatter(normalizeTimeZone(timeZone));
  return formatter.format(referenceDate);
}

export function dateStringToUtcDate(value: string, hour = 12) {
  const { year, month, day } = getUtcDateParts(value);
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0));
}

export function addDaysToDateString(value: string, days: number) {
  const date = dateStringToUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function compareDateStrings(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
}

export function differenceInCalendarDays(left: string, right: string) {
  const leftDate = dateStringToUtcDate(left, 0);
  const rightDate = dateStringToUtcDate(right, 0);
  const milliseconds = leftDate.getTime() - rightDate.getTime();
  return Math.round(milliseconds / 86_400_000);
}

export function startOfMonthDateString(value: string) {
  const { year, month } = getUtcDateParts(value);
  return `${year}-${pad(month)}-01`;
}

export function endOfMonthDateString(value: string) {
  const start = startOfMonthDateString(value);
  const nextMonth = addDaysToDateString(start, 32);
  const nextMonthStart = startOfMonthDateString(nextMonth);
  return addDaysToDateString(nextMonthStart, -1);
}

export function startOfCalendarGrid(value: string) {
  const monthStart = startOfMonthDateString(value);
  const date = dateStringToUtcDate(monthStart);
  const dayOfWeek = date.getUTCDay();
  return addDaysToDateString(monthStart, -dayOfWeek);
}

export function endOfCalendarGrid(value: string) {
  const monthEnd = endOfMonthDateString(value);
  const date = dateStringToUtcDate(monthEnd);
  const dayOfWeek = date.getUTCDay();
  return addDaysToDateString(monthEnd, 6 - dayOfWeek);
}

export function listDateStringsInRange(start: string, end: string) {
  if (compareDateStrings(start, end) > 0) {
    return [];
  }

  const dates: string[] = [];
  let cursor = start;
  while (compareDateStrings(cursor, end) <= 0) {
    dates.push(cursor);
    cursor = addDaysToDateString(cursor, 1);
  }
  return dates;
}

export function formatDateForDisplay(
  value: string,
  options?: Intl.DateTimeFormatOptions,
  locale = "en-US",
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...options,
  }).format(dateStringToUtcDate(value));
}

export function formatMonthLabel(value: string, locale = "en-US") {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(dateStringToUtcDate(value));
}

export function toCompactDateString(value: string) {
  const { year, month, day } = getUtcDateParts(value);
  return `${year}${pad(month)}${pad(day)}`;
}
