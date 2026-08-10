import assert from "node:assert/strict";
import test from "node:test";
import { checkStructured } from "./content-quality.ts";
import { OPTIONS_QUALITY_SPEC, ROADMAP_QUALITY_SPEC, STEP_GUIDANCE_QUALITY_SPEC, WORK_EVALUATION_QUALITY_SPEC, buildAllowedTerms } from "./content-quality-specs.ts";

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
  assert.ok(checkStructured({ project_title: "Short", short_overview: "short", project_brief: "short", steps: [] }, ROADMAP_QUALITY_SPEC).issues.length > 0);
  assert.ok(checkStructured({ what_to_do_now: "short" }, STEP_GUIDANCE_QUALITY_SPEC).issues.length > 0);
  assert.ok(checkStructured({ overall_assessment: "short" }, WORK_EVALUATION_QUALITY_SPEC).issues.length > 0);
});
