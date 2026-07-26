import assert from "node:assert/strict";
import test from "node:test";
import type { ErrorEvent } from "@sentry/nextjs";
import { sanitizeSentryContext, scrubSentryEvent } from "./privacy.ts";

test("sanitizeSentryContext keeps operational labels and removes identifiers and content", () => {
  assert.deepEqual(
    sanitizeSentryContext({
      route: "ai/roadmap",
      stage: "persist",
      project_id: "student-project-id",
      prompt: "student content",
    }),
    {
      route: "ai/roadmap",
      stage: "persist",
    },
  );
});

test("scrubSentryEvent removes request, user, message, breadcrumb, and source content", () => {
  const event: ErrorEvent = {
    type: undefined,
    message: "Provider rejected student submission content",
    request: {
      data: "student submission",
      headers: { authorization: "Bearer secret" },
      query_string: "token=secret",
      url: "https://sevri.co/api/projects/private-id",
    },
    user: { id: "student-id", email: "student@example.com" },
    contexts: { response: { data: "AI output" } },
    extra: {
      route: "ai/milestones/evaluate",
      stage: "provider",
      project_id: "student-project-id",
      output: "AI output",
    },
    breadcrumbs: [
      {
        category: "fetch",
        message: "POST /api/ai with student content",
        data: { requestBody: "student content" },
      },
    ],
    exception: {
      values: [
        {
          type: "ProviderError",
          value: "Provider rejected student submission content",
          stacktrace: {
            frames: [
              {
                filename: "src/app/api/ai/route.ts",
                function: "POST",
                lineno: 42,
                context_line: "const prompt = studentSubmission;",
                vars: { prompt: "student content" },
              },
            ],
          },
        },
      ],
    },
  };

  const scrubbed = scrubSentryEvent(event);
  const frame = scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0];

  assert.equal(scrubbed.message, undefined);
  assert.equal(scrubbed.request, undefined);
  assert.equal(scrubbed.user, undefined);
  assert.equal(scrubbed.contexts, undefined);
  assert.deepEqual(scrubbed.extra, {
    route: "ai/milestones/evaluate",
    stage: "provider",
  });
  assert.deepEqual(scrubbed.breadcrumbs, [{ category: "fetch" }]);
  assert.equal(scrubbed.exception?.values?.[0]?.value, "ProviderError (message redacted)");
  assert.equal(frame?.context_line, undefined);
  assert.equal(frame?.vars, undefined);
});
