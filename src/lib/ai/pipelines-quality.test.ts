// Integration-style tests for the validator contract used by pipelines.ts.
// The validator in each stage concatenates semantic issues with the quality
// feedback produced by `buildRepairFeedback(checkStructured(parsed, spec))`.
// These tests exercise that composition against hand-crafted broken fixtures.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { zodTextFormat } from "openai/helpers/zod";
import { onboardingInputSchema } from "../validators/onboarding.ts";
import { buildRepairFeedback, checkStructured } from "./content-quality.ts";
import {
  OPTIONS_QUALITY_SPEC,
  ROADMAP_QUALITY_SPEC,
  STEP_GUIDANCE_QUALITY_SPEC,
  WORK_EVALUATION_QUALITY_SPEC,
} from "./content-quality-specs.ts";
import { LearningResourceSchema, RoadmapGenerationSchema, WorkEvaluationSchema } from "./schemas.ts";
import { canonicalSourceUrl } from "./source-url.ts";

function validatorFeedback(parsed: unknown, spec: Parameters<typeof checkStructured>[1]): string[] {
  const report = checkStructured(parsed, spec);
  return buildRepairFeedback(report);
}

test("options validator surfaces feedback for broken recommendation", () => {
  const bad = {
    recommendations: [
      {
        title: "Build a robot that learns to rec-",
        summary: "A truncated",
        why_it_fits: "Ends with and",
        track_payload_json: {
          target_user: "A complete and specific user sentence here now.",
          problem_statement: "A complete and specific problem sentence here now.",
          core_workflow: "A complete and specific workflow sentence here now.",
          mvp_boundary: "A complete and specific boundary sentence here now.",
          validation_plan: "A complete and specific validation sentence here.",
        },
      },
    ],
  };
  const feedback = validatorFeedback(bad, OPTIONS_QUALITY_SPEC);
  assert.ok(feedback.length > 0);
  assert.ok(feedback.some((line) => line.includes("recommendations[0].title")));
  assert.ok(feedback.every((line) => typeof line === "string" && line.length > 0));
});

test("options validator is empty for a well-formed payload", () => {
  const good = {
    recommendations: [
      {
        title: "Finishable build option one.",
        summary: "A complete summary that spans at least sixty characters easily.",
        why_it_fits: "A complete fit note that spans at least sixty characters today.",
        track_payload_json: {
          target_user: "A complete user sentence that goes past twenty-four chars.",
          problem_statement: "A complete problem sentence past twenty-four characters.",
          core_workflow: "A complete workflow sentence past twenty-four characters.",
          mvp_boundary: "A complete boundary sentence past twenty-four characters.",
          validation_plan: "A complete validation sentence past twenty-four characters.",
        },
      },
    ],
  };
  const feedback = validatorFeedback(good, OPTIONS_QUALITY_SPEC);
  assert.deepEqual(feedback, []);
});

test("roadmap validator surfaces feedback for broken project title and step", () => {
  const bad = {
    project_title: "Trunc",
    short_overview: "A complete overview that spans at least sixty characters for clarity.",
    project_brief: "A complete brief spanning at least one hundred and twenty characters to keep the reader grounded in context and direction.",
    steps: [
      {
        title: "A clean title.",
        objective: "Ends with the",
        deliverable: "A concrete deliverable sentence that reads as a whole.",
        validation_check: "A concrete check sentence that reads as a whole.",
        scope_guardrail: "A concrete guardrail sentence that reads as a whole.",
      },
    ],
    cut_if_behind: ["If behind, drop this specific deliverable completely."],
    success_criteria: ["You know you are done when this specific event occurs."],
  };
  const feedback = validatorFeedback(bad, ROADMAP_QUALITY_SPEC);
  assert.ok(feedback.some((line) => line.includes("project_title")));
  assert.ok(feedback.some((line) => line.includes("steps[0].objective")));
});

test("roadmap response schema uses a supported URL pattern instead of format uri", () => {
  const format = zodTextFormat(RoadmapGenerationSchema, "roadmap_schema_test") as unknown as {
    schema: Record<string, unknown>;
  };
  const serialized = JSON.stringify(format.schema);

  assert.doesNotMatch(serialized, /"format":"uri"/);
  assert.match(serialized, /"pattern":"\^https\?\:/);

  const validResource = {
    title: "OpenAI Responses API guide",
    provider: "OpenAI",
    url: "https://developers.openai.com/api/docs/guides/structured-outputs",
    resource_type: "documentation",
    learning_stage: "start_here",
    why_it_matters: "It explains how to build and validate structured model responses.",
    use_during_step: 1,
    free_access: true,
  };
  assert.equal(LearningResourceSchema.safeParse(validResource).success, true);
  assert.equal(
    LearningResourceSchema.safeParse({ ...validResource, url: "not a real URL" }).success,
    false,
  );
});

test("source URL canonicalization preserves content queries and removes known tracking", () => {
  const firstVideo = canonicalSourceUrl("https://www.youtube.com/watch?v=one");
  const secondVideo = canonicalSourceUrl("https://www.youtube.com/watch?v=two");

  assert.notEqual(firstVideo, secondVideo, "distinct query-addressed resources must stay distinct");
  assert.equal(
    canonicalSourceUrl(
      "https://www.youtube.com/watch?utm_source=newsletter&v=one&utm_campaign=launch",
    ),
    firstVideo,
    "recognized tracking parameters should not prevent an evidence match",
  );
  assert.equal(
    canonicalSourceUrl("https://example.com/guide?language=en&chapter=2"),
    canonicalSourceUrl("https://example.com/guide?chapter=2&language=en"),
    "query ordering alone should not create distinct resources",
  );
  assert.notEqual(
    canonicalSourceUrl("https://www.youtube.com/watch?v=guessed"),
    firstVideo,
    "a guessed content identifier must not match a different cited resource",
  );
});

test("step guidance validator surfaces feedback for truncated email subject", () => {
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

test("work evaluation schema keeps legacy evaluations compatible while accepting scope assessment", () => {
  const legacyEvaluation = {
    criterion_verdicts: [{
      criterion: "The required validation check is satisfied.",
      verdict: "pass",
      note: "The submission includes direct evidence for this criterion.",
    }],
    overall_assessment: "The submission satisfies the required criterion with clear supporting evidence.",
    strongest_aspect: "The evidence is concrete and easy to verify.",
    clearest_gap: "No required criterion is currently missing.",
    next_best_action: "Mark the step complete and continue to the next step.",
    ready_to_mark_complete: true,
  };

  assert.equal(WorkEvaluationSchema.parse(legacyEvaluation).scope_assessment, undefined);
  assert.equal(
    WorkEvaluationSchema.parse({
      ...legacyEvaluation,
      criterion_verdicts: [{ ...legacyEvaluation.criterion_verdicts[0], verdict: "met" }],
      scope_assessment: {
        drifted: true,
        out_of_scope_note: "Park the added export feature because it is outside this step.",
      },
    }).scope_assessment?.drifted,
    true,
  );
  assert.equal(
    WorkEvaluationSchema.parse({ ...legacyEvaluation, scope_assessment: null }).scope_assessment,
    null,
  );
});

test("validator feedback identifies the field and gives human-readable repair guidance", () => {
  const bad = {
    recommendations: [
      {
        title: "Trunc-",
        summary: "A complete summary spanning past sixty characters for the reader.",
        why_it_fits: "A complete fit note that spans past sixty characters in length.",
        track_payload_json: {
          target_user: "A complete user sentence past twenty-four characters.",
          problem_statement: "A complete problem sentence past twenty-four chars.",
          core_workflow: "A complete workflow sentence past twenty-four chars.",
          mvp_boundary: "A complete boundary sentence past twenty-four chars.",
          validation_plan: "A complete validation sentence past twenty-four chars.",
        },
      },
    ],
  };
  const feedback = validatorFeedback(bad, OPTIONS_QUALITY_SPEC);
  const titleLine = feedback.find((line) => line.includes("recommendations[0].title"));
  assert.ok(titleLine);
  assert.match(titleLine!, /write the whole word|write a fuller version/i);
  assert.match(titleLine!, /rewrite the whole field as one complete thought/i);
  assert.doesNotMatch(titleLine!, /mid_word_end|too_short/);
});

test("research onboarding accepts intermediate experience and prompt code calibrates it distinctly", () => {
  const intake = onboardingInputSchema.parse({
    project_track: "research",
    student_stage: "high_school_junior",
    target_outcome: "portfolio",
    interests: ["behavioral economics"],
    favorite_subjects: ["statistics"],
    weekly_time_available: 6,
    preferred_research_domain: "behavioral economics",
    research_experience: "intermediate",
    methodology_preference: "data_analysis",
    target_research_deliverable: "paper",
    data_or_resource_access: "Public datasets.",
  });

  const generationContextSource = readFileSync(new URL("./generation-context.ts", import.meta.url), "utf8");
  const promptsSource = readFileSync(new URL("./prompts.ts", import.meta.url), "utf8");

  assert.equal(intake.project_track, "research");
  if (intake.project_track !== "research") {
    throw new Error("Expected research intake.");
  }
  assert.equal(intake.research_experience, "intermediate");
  assert.match(generationContextSource, /skill === "intermediate"/);
  assert.match(generationContextSource, /structured method/i);
  assert.match(promptsSource, /Preserve current experience and preferred challenge as separate signals/);
  assert.match(promptsSource, /comparative scope tiers, not claims about the student's ability/);
});
