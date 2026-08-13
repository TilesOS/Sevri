import assert from "node:assert/strict";
import test from "node:test";
import { withProfileIdentity } from "./intake-identity.ts";

const intake = { student_stage: "college_freshman", interests: ["silicon photonics"], experience_level: "advanced", format_preferences: ["physical", "digital"] };
test("profile identity overlays stale intake stage", () => assert.equal(withProfileIdentity(intake, { studentStage: "college_sophomore" }).student_stage, "college_sophomore"));
test("project context is left untouched", () => assert.deepEqual(withProfileIdentity(intake, { studentStage: "college_senior" }).format_preferences, ["physical", "digital"]));
test("the stored intake is not mutated", () => { const original = structuredClone(intake); withProfileIdentity(intake, { studentStage: "high_school_senior" }); assert.deepEqual(intake, original); });
test("a missing profile stage keeps the intake answer", () => assert.equal(withProfileIdentity(intake, { studentStage: null }).student_stage, "college_freshman"));
