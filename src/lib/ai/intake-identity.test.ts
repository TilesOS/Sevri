import assert from "node:assert/strict";
import test from "node:test";
import { withProfileIdentity } from "./intake-identity.ts";

// The defect this guards (DES-027): a student ran onboarding on both tracks, and
// each intake kept its own `student_stage`. Generation read the intake JSON, so
// the software track called them a college freshman while the research track
// called them a high school junior.
const softwareIntake = {
  project_track: "software",
  student_stage: "college_freshman",
  interests: ["silicon photonics"],
  coding_experience: "advanced",
};

const researchIntake = {
  project_track: "research",
  student_stage: "high_school_junior",
  interests: ["electrical engineering"],
  research_experience: "beginner",
};

test("both tracks read the same stage once the profile has one", () => {
  const identity = { studentStage: "college_sophomore" as const };

  const software = withProfileIdentity(softwareIntake, identity);
  const research = withProfileIdentity(researchIntake, identity);

  assert.equal(software.student_stage, "college_sophomore");
  assert.equal(research.student_stage, "college_sophomore");
  assert.equal(software.student_stage, research.student_stage);
});

test("track-specific context is left untouched", () => {
  const overlaid = withProfileIdentity(researchIntake, { studentStage: "college_senior" });

  assert.deepEqual(overlaid.interests, ["electrical engineering"]);
  assert.equal(overlaid.research_experience, "beginner");
  assert.equal(overlaid.project_track, "research");
});

test("the stored intake is not mutated", () => {
  const original = { ...softwareIntake };
  withProfileIdentity(softwareIntake, { studentStage: "high_school_senior" });

  assert.deepEqual(softwareIntake, original);
});

test("a profile with no stage keeps the intake's own answer rather than dropping it", () => {
  const overlaid = withProfileIdentity(softwareIntake, { studentStage: null });

  assert.equal(overlaid.student_stage, "college_freshman");
});

test("an intake with no stage picks up the profile's", () => {
  const overlaid = withProfileIdentity({ project_track: "software" }, { studentStage: "high_school_freshman" });

  assert.equal(overlaid.student_stage, "high_school_freshman");
});
