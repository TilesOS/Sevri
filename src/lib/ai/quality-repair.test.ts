import assert from "node:assert/strict";
import test from "node:test";
import { checkStructured } from "./content-quality.ts";
import { OPTIONS_QUALITY_SPEC } from "./content-quality-specs.ts";
import {
  applyQualityFieldRepairs,
  buildQualityRepairPrompts,
  buildQualityFieldRepairSchema,
  buildQualityRepairTargets,
  canUseDeterministicQualityCleanup,
  getStringAtPath,
  shouldSkipCrossModelFallbackForQuality,
} from "./quality-repair.ts";

function brokenBoard() {
  return {
    recommendations: [
      {
        id: "focused",
        title: "Neighborhood Heat Evidence Map",
        summary: "Map neighborhood heat exposure and turn the pattern into a concrete local planning case.",
        why_it_fits: "This direction connects geographic analysis to a practical public-health decision.",
        difficulty: "beginner",
        impressiveness_score: 7,
        track_payload_json: {
          target_user: "Community health coordinators",
          problem_statement: "Heat-risk evidence is scattered across incompatible public datasets",
          core_workflow: "Join neighborhood data, score exposure, and inspect results with:",
          mvp_boundary: "One city, two datasets, and one comparison map",
          validation_plan: "Compare the resulting hotspots with",
        },
      },
      {
        id: "ambitious",
        title: "Thermal Equity Scenario Lab",
        summary: "Model interventions across neighborhoods and compare their likely distributional effects.",
        why_it_fits: "This preserves the student's ambitious systems-analysis direction.",
        difficulty: "advanced",
        impressiveness_score: 10,
        track_payload_json: {
          target_user: "Municipal resilience analysts",
          problem_statement: "Planning teams cannot compare intervention tradeoffs consistently",
          core_workflow: "Simulate scenarios and compare exposure changes across neighborhoods",
          mvp_boundary: "One intervention family and one city are included; forecasting is excluded",
          validation_plan: "Compare scenario rankings with a published municipal resilience plan",
        },
      },
    ],
  };
}

test("buildQualityRepairTargets groups issue details by exact field path", () => {
  const board = brokenBoard();
  const report = checkStructured(board, OPTIONS_QUALITY_SPEC);
  const targets = buildQualityRepairTargets(board, report, OPTIONS_QUALITY_SPEC);

  assert.deepEqual(
    targets.map((target) => target.path),
    [
      "recommendations[0].track_payload_json.core_workflow",
      "recommendations[0].track_payload_json.validation_plan",
    ],
  );
  assert.deepEqual(
    targets[0].issues.map((issue) => issue.kind),
    ["dangling_colon_dash", "trailing_connector"],
  );
  assert.equal(targets[0].constraints.maxLength, 220);
});

test("deterministic cleanup is limited to mechanics that cannot remove meaning", () => {
  const broken = checkStructured(brokenBoard(), OPTIONS_QUALITY_SPEC);
  assert.equal(canUseDeterministicQualityCleanup(broken), false);

  const missingPeriod = checkStructured(
    { overview: "This thought is complete but lacks its final punctuation" },
    { overview: { kind: "prose", minCredible: 16, maxLength: 120 } },
  );
  assert.deepEqual(missingPeriod.issues.map((issue) => issue.kind), ["missing_terminal_punct"]);
  assert.equal(canUseDeterministicQualityCleanup(missingPeriod), true);
});

test("quality-only repair exhaustion stays on the primary model", () => {
  assert.equal(
    shouldSkipCrossModelFallbackForQuality({
      isPrimaryModel: true,
      semanticIssueCount: 0,
      qualityIssueCount: 3,
      repairFailureAllowsFallback: false,
    }),
    true,
  );
  assert.equal(
    shouldSkipCrossModelFallbackForQuality({
      isPrimaryModel: true,
      semanticIssueCount: 1,
      qualityIssueCount: 3,
      repairFailureAllowsFallback: false,
    }),
    false,
    "broad semantic failures may still use the configured fallback",
  );
  assert.equal(
    shouldSkipCrossModelFallbackForQuality({
      isPrimaryModel: true,
      semanticIssueCount: 0,
      qualityIssueCount: 3,
      repairFailureAllowsFallback: true,
    }),
    false,
    "provider, refusal, and incomplete repair failures may still use the fallback",
  );
});

test("dynamic repair schema leaves length enforcement to post-repair validation", () => {
  const board = brokenBoard();
  const report = checkStructured(board, OPTIONS_QUALITY_SPEC);
  const targets = buildQualityRepairTargets(board, report, OPTIONS_QUALITY_SPEC);
  const schema = buildQualityFieldRepairSchema(targets);
  const validCoreWorkflow = "Inspect one heat-risk map and compare the highest-risk blocks.";
  const validValidationPlan = "Compare the hotspots with a published municipal assessment.";

  assert.equal(schema.safeParse({
    repairs: [
      { path: targets[0].path, replacement: validCoreWorkflow },
      { path: targets[1].path, replacement: validValidationPlan },
    ],
  }).success, true);
  const overBudgetBatch = {
    repairs: [
      { path: targets[0].path, replacement: "x".repeat(221) },
      { path: targets[1].path, replacement: validValidationPlan },
    ],
  };
  assert.equal(
    schema.safeParse(overBudgetBatch).success,
    true,
    "a decoder maxLength causes Luna to fill and truncate at that boundary",
  );

  const applied = applyQualityFieldRepairs({
    base: board,
    expectedPaths: targets.map((target) => target.path),
    batch: overBudgetBatch,
  });
  assert.ok(applied.candidate);
  assert.ok(
    checkStructured(applied.candidate, OPTIONS_QUALITY_SPEC).issues.some(
      (issue) => issue.path === targets[0].path && issue.kind === "too_long",
    ),
    "normal post-repair validation still enforces the original field budget",
  );
});

test("repair prompt returns the original response to the model with targeted fields", () => {
  const board = brokenBoard();
  const report = checkStructured(board, OPTIONS_QUALITY_SPEC);
  const targets = buildQualityRepairTargets(board, report, OPTIONS_QUALITY_SPEC);
  const prompts = buildQualityRepairPrompts({ stage: "options", original: board, targets });

  assert.match(prompts.systemPrompt, /Change only the requested strings/i);
  assert.match(prompts.userPrompt, /Neighborhood Heat Evidence Map/);
  assert.match(prompts.userPrompt, /recommendations\[0\]\.track_payload_json\.validation_plan/);
  assert.match(prompts.userPrompt, /Compare the resulting hotspots with/);
  assert.match(prompts.systemPrompt, /preferred_max_length/);
  assert.match(prompts.userPrompt, /"preferred_max_length": 165/);
  assert.match(prompts.userPrompt, /"hard_max_length": 220/);
});

test("field repairs preserve every unflagged value in the original board", () => {
  const board = brokenBoard();
  const original = structuredClone(board);
  const paths = [
    "recommendations[0].track_payload_json.core_workflow",
    "recommendations[0].track_payload_json.validation_plan",
  ];
  const applied = applyQualityFieldRepairs({
    base: board,
    expectedPaths: paths,
    batch: {
      repairs: [
        {
          path: paths[0],
          replacement: "Join neighborhood data, score exposure, and inspect the highest-risk blocks.",
        },
        {
          path: paths[1],
          replacement: "Compare the resulting hotspots with a published municipal heat assessment.",
        },
      ],
    },
  });

  assert.ok(applied.candidate);
  assert.deepEqual(board, original, "the original model response must remain untouched");
  assert.deepEqual(applied.candidate!.recommendations[1], original.recommendations[1]);
  assert.equal(applied.candidate!.recommendations[0].title, original.recommendations[0].title);
  assert.equal(
    getStringAtPath(applied.candidate, paths[1]),
    "Compare the resulting hotspots with a published municipal heat assessment.",
  );
  assert.deepEqual(checkStructured(applied.candidate, OPTIONS_QUALITY_SPEC).issues, []);
});

test("a residual repair round targets only fields that remain invalid", () => {
  const board = brokenBoard();
  const initialReport = checkStructured(board, OPTIONS_QUALITY_SPEC);
  const initialTargets = buildQualityRepairTargets(board, initialReport, OPTIONS_QUALITY_SPEC);
  const firstRound = applyQualityFieldRepairs({
    base: board,
    expectedPaths: initialTargets.map((target) => target.path),
    batch: {
      repairs: [
        {
          path: initialTargets[0].path,
          replacement: "Inspect one heat-risk map and compare the highest-risk blocks.",
        },
        {
          path: initialTargets[1].path,
          replacement: "Compare the resulting hotspots with",
        },
      ],
    },
  });

  assert.ok(firstRound.candidate);
  const residualReport = checkStructured(firstRound.candidate, OPTIONS_QUALITY_SPEC);
  const residualTargets = buildQualityRepairTargets(
    firstRound.candidate,
    residualReport,
    OPTIONS_QUALITY_SPEC,
  );
  assert.deepEqual(
    residualTargets.map((target) => target.path),
    ["recommendations[0].track_payload_json.validation_plan"],
  );
});

test("field repair contract rejects missing, duplicate, and unexpected paths", () => {
  const board = brokenBoard();
  const expectedPaths = [
    "recommendations[0].track_payload_json.core_workflow",
    "recommendations[0].track_payload_json.validation_plan",
  ];
  const applied = applyQualityFieldRepairs({
    base: board,
    expectedPaths,
    batch: {
      repairs: [
        { path: expectedPaths[0], replacement: "A complete replacement value for the first field." },
        { path: expectedPaths[0], replacement: "A duplicate replacement that must be rejected." },
        { path: "recommendations[1].title", replacement: "An unauthorized title rewrite" },
      ],
    },
  });

  assert.equal(applied.candidate, null);
  assert.ok(applied.issues.some((issue) => issue.startsWith("Duplicate repair path")));
  assert.ok(applied.issues.some((issue) => issue.startsWith("Unexpected repair path")));
  assert.ok(applied.issues.some((issue) => issue.startsWith("Missing repair path")));
});
