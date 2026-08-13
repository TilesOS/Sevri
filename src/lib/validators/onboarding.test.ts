import assert from "node:assert/strict";
import test from "node:test";
import { onboardingInputSchema } from "./onboarding.ts";

const valid = { student_stage: "high_school_junior", project_goal: "portfolio", success_definition: "A finished artifact I can show and explain clearly.", interests: ["urban ecology"], favorite_subjects: ["biology"], open_to_anything: false, format_preferences: ["physical", "community"], experience_level: "beginner", existing_skills: ["sketching"], available_resources: "school workshop", weekly_time_available: 5, budget_constraints: "$75", preferred_challenge: "intermediate", other_constraints: "Adult supervision for power tools." };

test("universal onboarding accepts a cross-domain intake", () => assert.deepEqual(onboardingInputSchema.parse(valid).format_preferences, ["physical", "community"]));
test("universal onboarding requires a format unless open", () => assert.equal(onboardingInputSchema.safeParse({ ...valid, format_preferences: [] }).success, false));
test("universal onboarding allows an open brief", () => assert.equal(onboardingInputSchema.safeParse({ ...valid, open_to_anything: true, format_preferences: [] }).success, true));
