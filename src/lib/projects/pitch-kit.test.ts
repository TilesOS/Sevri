import assert from "node:assert/strict";
import test from "node:test";
import { composePitchKitDraft, composeScopeStatement, toDeferralList } from "./pitch-kit.ts";

const seed = { central_challenge: "Help a neighborhood garden use less water.", approach: "Prototype and test a low-cost moisture indicator.", primary_artifacts: ["A working indicator", "A test log"], proof_of_success: ["Three gardeners can interpret the signal"], scope_boundary: "One garden bed and one indicator design.", resources_needed: ["Basic hand tools"] };
test("universal pitch kit builds truthful blueprint copy", () => assert.equal(composePitchKitDraft({ projectTitle: "Garden Signal", seed, stepCount: 5 }).talkingPoints.length, 3));
test("universal pitch kit protects core scope", () => assert.match(composeScopeStatement({ seed }), /One garden bed/u));
test("universal pitch kit turns cuts into future deferrals", () => assert.match(toDeferralList(["Drop the solar enclosure"])[0], /^Later:/u));
