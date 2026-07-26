import type { Breadcrumb, ErrorEvent, StackFrame } from "@sentry/nextjs";

const SAFE_CONTEXT_KEYS = new Set([
  "code",
  "digest",
  "mechanism",
  "operation",
  "route",
  "runtime",
  "stage",
  "status",
  "step",
  "surface",
]);

function sanitizeValue(value: unknown) {
  if (typeof value === "string") {
    return value.slice(0, 120);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return undefined;
}

export function sanitizeSentryContext(context?: Record<string, unknown>) {
  if (!context) {
    return undefined;
  }

  const sanitized = Object.entries(context).reduce<Record<string, string | number | boolean>>(
    (result, [key, value]) => {
      if (!SAFE_CONTEXT_KEYS.has(key)) {
        return result;
      }

      const sanitizedValue = sanitizeValue(value);
      if (sanitizedValue !== undefined) {
        result[key] = sanitizedValue;
      }

      return result;
    },
    {},
  );

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function scrubStackFrame(frame: StackFrame): StackFrame {
  return {
    filename: frame.filename,
    function: frame.function,
    module: frame.module,
    platform: frame.platform,
    lineno: frame.lineno,
    colno: frame.colno,
    in_app: frame.in_app,
  };
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...(breadcrumb.timestamp !== undefined ? { timestamp: breadcrumb.timestamp } : {}),
    ...(breadcrumb.type !== undefined ? { type: breadcrumb.type } : {}),
    ...(breadcrumb.category !== undefined ? { category: breadcrumb.category } : {}),
    ...(breadcrumb.level !== undefined ? { level: breadcrumb.level } : {}),
  };
}

/**
 * Sevri handles student work and AI input/output. Keep the stack and a small
 * set of fixed operational labels, but remove request data, identifiers,
 * messages, source context, and arbitrary extras before an event leaves the
 * process.
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const exception = event.exception
    ? {
        ...event.exception,
        values: event.exception.values?.map((value) => ({
          type: value.type,
          value: value.type ? `${value.type} (message redacted)` : "Error (message redacted)",
          mechanism: value.mechanism
            ? {
                type: value.mechanism.type,
                handled: value.mechanism.handled,
                synthetic: value.mechanism.synthetic,
              }
            : undefined,
          stacktrace: value.stacktrace
            ? {
                ...value.stacktrace,
                frames: value.stacktrace.frames?.map(scrubStackFrame),
              }
            : undefined,
        })),
      }
    : undefined;

  return {
    ...event,
    breadcrumbs: event.breadcrumbs?.map(scrubSentryBreadcrumb),
    contexts: undefined,
    exception,
    extra: sanitizeSentryContext(event.extra),
    fingerprint: undefined,
    logentry: undefined,
    measurements: undefined,
    message: undefined,
    modules: undefined,
    request: undefined,
    sdkProcessingMetadata: undefined,
    server_name: undefined,
    spans: undefined,
    tags: sanitizeSentryContext(event.tags),
    threads: undefined,
    transaction: undefined,
    transaction_info: undefined,
    user: undefined,
  };
}
