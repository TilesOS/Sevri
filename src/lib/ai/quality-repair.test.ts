import assert from "node:assert/strict";
import test from "node:test";
import { checkStructured } from "./content-quality.ts";
import { OPTIONS_QUALITY_SPEC } from "./content-quality-specs.ts";
import { applyQualityFieldRepairs, buildQualityRepairTargets, canUseDeterministicQualityCleanup, getStringAtPath } from "./quality-repair.ts";

const board = { recommendations: [{ title: "Neighborhood Heat Evidence Map", summary: "Map neighborhood heat exposure and turn the pattern into a concrete local planning case.", why_it_fits: "This direction connects geographic analysis to a practical public-health decision.", project_blueprint_json: { central_challenge: "Show where neighborhood heat risk is concentrated.", approach: "Join public data, score exposure, and inspect results with:", scope_boundary: "Compare the resulting hotspots with" } }] };
test("quality repair targets exact universal blueprint fields", () => {
  const targets = buildQualityRepairTargets(board, checkStructured(board, OPTIONS_QUALITY_SPEC), OPTIONS_QUALITY_SPEC);
  assert.deepEqual(targets.map((target) => target.path), ["recommendations[0].project_blueprint_json.approach", "recommendations[0].project_blueprint_json.scope_boundary"]);
});
test("field repair preserves all unflagged content", () => {
  const paths = ["recommendations[0].project_blueprint_json.approach", "recommendations[0].project_blueprint_json.scope_boundary"];
  const applied = applyQualityFieldRepairs({ base: board, expectedPaths: paths, batch: { repairs: [{ path: paths[0], replacement: "Join public data, score exposure, and inspect the highest-risk blocks." }, { path: paths[1], replacement: "One city, two datasets, and one comparison map." }] } });
  assert.equal(applied.candidate?.recommendations[0].title, board.recommendations[0].title);
  assert.match(getStringAtPath(applied.candidate, paths[1]) ?? "", /One city/u);
});
test("deterministic cleanup only handles safe mechanics", () => assert.equal(canUseDeterministicQualityCleanup(checkStructured(board, OPTIONS_QUALITY_SPEC)), false));
