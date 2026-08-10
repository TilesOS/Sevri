import assert from "node:assert/strict";
import test from "node:test";
import { onboardingInputSchema } from "./onboarding.ts";

function softwareIntake(overrides: Record<string, unknown> = {}) {
  return {
    project_track: "software",
    student_stage: "high_school_junior",
    target_outcome: "portfolio",
    interests: ["climate"],
    favorite_subjects: ["biology"],
    weekly_time_available: 6,
    preferred_difficulty: "advanced",
    coding_experience: "beginner",
    preferred_project_style: "web app",
    known_tools: ["React"],
    ...overrides,
  };
}

function researchIntake(overrides: Record<string, unknown> = {}) {
  return {
    project_track: "research",
    student_stage: "high_school_junior",
    target_outcome: "portfolio",
    interests: ["policy"],
    favorite_subjects: ["economics"],
    weekly_time_available: 6,
    preferred_difficulty: "advanced",
    preferred_research_domain: "public health",
    research_experience: "beginner",
    methodology_preference: "data_analysis",
    target_research_deliverable: "paper",
    ...overrides,
  };
}

test("a complete software intake parses", () => {
  assert.equal(onboardingInputSchema.safeParse(softwareIntake()).success, true);
});

test("a complete research intake parses", () => {
  assert.equal(onboardingInputSchema.safeParse(researchIntake()).success, true);
});

test("current experience and preferred challenge remain separate signals", () => {
  const result = onboardingInputSchema.safeParse(
    softwareIntake({ coding_experience: "beginner", preferred_difficulty: "advanced" }),
  );

  assert.equal(result.success, true);
  if (!result.success || result.data.project_track !== "software") return;
  assert.equal(result.data.coding_experience, "beginner");
  assert.equal(result.data.preferred_difficulty, "advanced");
});

test("older saved answers receive a compatible challenge default", () => {
  const intake: Record<string, unknown> = { ...softwareIntake() };
  Reflect.deleteProperty(intake, "preferred_difficulty");
  const result = onboardingInputSchema.safeParse(intake);

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.preferred_difficulty, "intermediate");
});

test("whitespace-only interests are rejected", () => {
  const result = onboardingInputSchema.safeParse(softwareIntake({ interests: ["   "] }));
  assert.equal(result.success, false);
});

test("whitespace-only favorite subjects are rejected", () => {
  const result = onboardingInputSchema.safeParse(softwareIntake({ favorite_subjects: ["  \t "] }));
  assert.equal(result.success, false);
});

test("an empty interests list is rejected", () => {
  assert.equal(onboardingInputSchema.safeParse(softwareIntake({ interests: [] })).success, false);
});

test("whitespace-only preferred project style is rejected", () => {
  const result = onboardingInputSchema.safeParse(softwareIntake({ preferred_project_style: "    " }));
  assert.equal(result.success, false);
});

test("whitespace-only preferred research domain is rejected", () => {
  const result = onboardingInputSchema.safeParse(researchIntake({ preferred_research_domain: "   " }));
  assert.equal(result.success, false);
});

test("whitespace-only student stage is rejected", () => {
  const result = onboardingInputSchema.safeParse(softwareIntake({ student_stage: "  " }));
  assert.equal(result.success, false);
});

test("a padded answer is accepted and stored trimmed", () => {
  const result = onboardingInputSchema.safeParse(
    softwareIntake({
      interests: ["  climate  "],
      favorite_subjects: [" biology "],
      preferred_project_style: "  web app  ",
    }),
  );

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.deepEqual(result.data.interests, ["climate"]);
  assert.deepEqual(result.data.favorite_subjects, ["biology"]);
  assert.equal(result.data.project_track, "software");
  if (result.data.project_track === "software") {
    assert.equal(result.data.preferred_project_style, "web app");
  }
});

test("whitespace-only optional answers are normalized rather than stored as spaces", () => {
  const result = onboardingInputSchema.safeParse(
    softwareIntake({ constraints: "   ", additional_context: "  heavy class load  " }),
  );

  assert.equal(result.success, true);
  if (!result.success) return;
  assert.equal(result.data.constraints, "");
  assert.equal(result.data.additional_context, "heavy class load");
});

test("a list of only blank entries is rejected", () => {
  assert.equal(
    onboardingInputSchema.safeParse(softwareIntake({ interests: [" ", "  "] })).success,
    false,
  );
});
