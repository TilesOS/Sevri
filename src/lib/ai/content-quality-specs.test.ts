import assert from "node:assert/strict";
import test from "node:test";
import { buildRepairFeedback, checkStructured } from "./content-quality.ts";
import { OPTIONS_QUALITY_SPEC, ROADMAP_QUALITY_SPEC, STEP_GUIDANCE_QUALITY_SPEC, WORK_EVALUATION_QUALITY_SPEC, buildAllowedTerms } from "./content-quality-specs.ts";

// Each pipeline stage validates with `buildRepairFeedback(checkStructured(parsed, spec))`.
// A repair round-trip is only useful if the feedback names the offending field, so
// these assert the exact path rather than merely that some issue was raised.
function validatorFeedback(parsed: unknown, spec: Parameters<typeof checkStructured>[1]): string[] {
  return buildRepairFeedback(checkStructured(parsed, spec));
}

test("allowed terms merge universal context anchors", () => {
  const terms = buildAllowedTerms({ interpreted_interests: ["Raspberry Pi", "GPU"], project_context_json: { anchor_interests: ["raspberry pi"] } } as never);
  assert.equal(terms.filter((term) => term.toLowerCase() === "raspberry pi").length, 1);
});
test("option quality checks universal blueprint fields", () => {
  const report = checkStructured({ recommendations: [{ title: "Truncated mid-", summary: "short", why_it_fits: "Ends with and", project_blueprint_json: { central_challenge: "too short", approach: "A complete approach that creates and tests a focused artifact.", scope_boundary: "One audience and one evidence loop." } }] }, OPTIONS_QUALITY_SPEC);
  const paths = new Set(report.issues.map((issue) => issue.path));
  assert.ok(paths.has("recommendations[0].title")); assert.ok(paths.has("recommendations[0].project_blueprint_json.central_challenge"));
});
test("roadmap, guidance, and evaluation specs remain active", () => {
  const roadmapPaths = new Set(
    checkStructured(
      { project_title: "Short", short_overview: "short", project_brief: "short", steps: [{ title: "Truncated mid-", objective: "short" }] },
      ROADMAP_QUALITY_SPEC,
    ).issues.map((issue) => issue.path),
  );
  assert.ok(roadmapPaths.has("short_overview"));
  assert.ok(roadmapPaths.has("steps[0].title"), "nested step paths carry their index");

  const guidancePaths = new Set(
    checkStructured({ what_to_do_now: "short" }, STEP_GUIDANCE_QUALITY_SPEC).issues.map((issue) => issue.path),
  );
  assert.ok(guidancePaths.has("what_to_do_now"));

  const evaluationPaths = new Set(
    checkStructured({ overall_assessment: "short" }, WORK_EVALUATION_QUALITY_SPEC).issues.map((issue) => issue.path),
  );
  assert.ok(evaluationPaths.has("overall_assessment"));
});

test("step guidance validator surfaces feedback for truncated email subject", () => {
  // Every field but the email subject is well-formed, so the feedback must
  // point at the nested subject rather than at the step body.
  const bad = {
    what_to_do_now: "A complete description of what to do now that is long enough to pass.",
    encouragement: "A complete encouragement that carries momentum through the step easily.",
    checklist: ["Do the focused thing completely."],
    pitfalls: ["Avoid this specific pitfall completely."],
    tools_resources: ["Use this specific tool completely well."],
    done_when: ["The specific completion condition is met clearly."],
    email_version: {
      subject: "Trunc-",
      preview: "A complete preview line for the reader.",
      body: "A complete body that reads past eighty characters so the reader understands the next action.",
    },
  };
  const feedback = validatorFeedback(bad, STEP_GUIDANCE_QUALITY_SPEC);
  assert.ok(feedback.some((line) => line.includes("email_version.subject")));
});

test("work evaluation validator surfaces feedback for too-short note", () => {
  // The offending note sits inside an array element; the feedback has to carry
  // the index so a repair pass can rewrite the right verdict.
  const bad = {
    criterion_verdicts: [{ criterion: "A clear label here.", note: "too short" }],
    overall_assessment: "A complete assessment that spans at least eighty characters for reader clarity and judgement context here today.",
    strongest_aspect: "A complete strongest aspect sentence for context.",
    clearest_gap: "A complete clearest gap sentence for the reader.",
    next_best_action: "A complete next best action description to follow.",
  };
  const feedback = validatorFeedback(bad, WORK_EVALUATION_QUALITY_SPEC);
  assert.ok(feedback.some((line) => line.includes("criterion_verdicts[0].note")));
});
test("roadmap prose uses writing targets instead of hard character cutoffs", () => {
  assert.equal(ROADMAP_QUALITY_SPEC["steps[*].deliverable"].maxLength, undefined);
  assert.equal(ROADMAP_QUALITY_SPEC["learning_resources[*].why_it_matters"].maxLength, undefined);
});
