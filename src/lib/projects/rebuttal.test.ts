import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_REBUTTAL_CHARS,
  MAX_REBUTTAL_SUBMISSION_CHARS,
  MAX_SUBMISSION_CHARS,
  buildRebuttalSubmissionPayload,
} from "./rebuttal.ts";
import type { StoredMilestoneSubmission } from "../../types/domain.ts";

function submission(
  overrides: Partial<StoredMilestoneSubmission> = {},
): StoredMilestoneSubmission {
  return {
    id: "submission-1",
    evidence_submission_id: null,
    submission_kind: "pasted_text",
    submission_text: "Original notes",
    submission_filename: null,
    created_at: "2026-08-13T12:00:00.000Z",
    updated_at: "2026-08-13T12:00:00.000Z",
    artifacts: [],
    ...overrides,
  };
}

test("artifact-backed rebuttals reference the original evidence submission", () => {
  const payload = buildRebuttalSubmissionPayload(submission({
    submission_kind: "artifact_bundle",
    submission_text: null,
    artifacts: [{
      id: "artifact-1",
      submission_id: "submission-1",
      upload_path: "user/evidence.pdf",
      external_url: null,
      display_name: "evidence.pdf",
      mime_type: "application/pdf",
      size_bytes: 100,
      caption: "Final report",
      alt_text: null,
      created_at: "2026-08-13T12:00:00.000Z",
      updated_at: "2026-08-13T12:00:00.000Z",
    }],
  }), "The report does include the appendix.");

  assert.equal(payload.evidenceSubmissionId, "submission-1");
  assert.match(payload.submissionText, /original artifact bundle is attached/i);
  assert.doesNotMatch(payload.submissionText, /Original submission notes:/);
});

test("a repeated rebuttal keeps the original evidence reference", () => {
  const payload = buildRebuttalSubmissionPayload(submission({
    id: "rebuttal-1",
    submission_kind: "artifact_bundle",
    evidence_submission_id: "submission-1",
    artifacts: [],
  }), "Please inspect the same report again.");

  assert.equal(payload.evidenceSubmissionId, "submission-1");
  assert.doesNotMatch(payload.submissionText, /Original notes/);
  assert.match(payload.submissionText, /original artifact bundle is attached/i);
});

test("the evaluation request limit accepts the largest artifact rebuttal the UI can build", () => {
  const payload = buildRebuttalSubmissionPayload(submission({
    submission_kind: "artifact_bundle",
    submission_text: "s".repeat(MAX_SUBMISSION_CHARS),
    artifacts: [{
      id: "artifact-1",
      submission_id: "submission-1",
      upload_path: "user/evidence.pdf",
      external_url: null,
      display_name: "evidence.pdf",
      mime_type: "application/pdf",
      size_bytes: 100,
      caption: "Final report",
      alt_text: null,
      created_at: "2026-08-13T12:00:00.000Z",
      updated_at: "2026-08-13T12:00:00.000Z",
    }],
  }), "r".repeat(MAX_REBUTTAL_CHARS));

  assert.equal(MAX_REBUTTAL_SUBMISSION_CHARS, 20_643);
  assert.equal(payload.submissionText.length, MAX_REBUTTAL_SUBMISSION_CHARS);
});
