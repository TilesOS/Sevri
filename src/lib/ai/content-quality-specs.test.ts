import assert from "node:assert/strict";
import test from "node:test";
import { checkStructured } from "./content-quality.ts";
import {
  OPTIONS_QUALITY_SPEC,
  ROADMAP_QUALITY_SPEC,
  STEP_GUIDANCE_QUALITY_SPEC,
  WORK_EVALUATION_QUALITY_SPEC,
  buildAllowedTerms,
} from "./content-quality-specs.ts";

test("buildAllowedTerms returns defaults with no context", () => {
  const terms = buildAllowedTerms(null);
  assert.ok(terms.includes("GPU"));
  assert.ok(terms.includes("API"));
});

test("buildAllowedTerms merges context anchors without duplicates", () => {
  const terms = buildAllowedTerms({
    interpreted_interests: ["Raspberry Pi", "GPU"],
    track_payload_json: { anchor_interests: ["raspberry pi"] },
  } as never);
  const lowered = terms.map((term) => term.toLowerCase());
  const rpCount = lowered.filter((term) => term === "raspberry pi").length;
  assert.equal(rpCount, 1);
  assert.ok(terms.includes("Raspberry Pi"));
});

test("OPTIONS_QUALITY_SPEC flags bad recommendation titles and summaries", () => {
  const parsed = {
    recommendations: [
      {
        title: "Fine title here",
        summary: "A complete summary that covers sixty characters, easy pace.",
        why_it_fits: "A complete fit note that reads as a whole sentence easily.",
        track_payload_json: {
          target_user: "Someone who wants an MVP built this quarter.",
          problem_statement: "Their onboarding funnel leaks at the second step badly.",
          core_workflow: "They need a guided set of actions that reduces drop-off.",
          mvp_boundary: "Only the first three onboarding steps are in scope.",
          validation_plan: "Measure completion rate across the new funnel cohort.",
        },
      },
      {
        title: "Truncated mid-",
        summary: "short",
        why_it_fits: "Ends with and",
        track_payload_json: {
          target_user: "too short",
          problem_statement: "A solid and complete description of the stated issue.",
          core_workflow: "A reasonably complete workflow sentence for clarity.",
          mvp_boundary: "A reasonably complete scope sentence for boundaries.",
          validation_plan: "A reasonably complete validation sentence overall.",
        },
      },
    ],
  };
  const report = checkStructured(parsed, OPTIONS_QUALITY_SPEC);
  const paths = new Set(report.issues.map((issue) => issue.path));
  assert.ok(paths.has("recommendations[1].title"));
  assert.ok(paths.has("recommendations[1].summary"));
  assert.ok(paths.has("recommendations[1].why_it_fits"));
  assert.ok(paths.has("recommendations[1].track_payload_json.target_user"));
});

test("option seed descriptors do not require sentence punctuation", () => {
  const parsed = {
    recommendations: [
      {
        title: "Community Heat Mapper",
        summary: "Map neighborhood heat exposure and turn the pattern into a concrete local planning case.",
        why_it_fits: "This direction connects geographic analysis to a practical public-health decision.",
        track_payload_json: {
          target_user: "Community health coordinators",
          problem_statement: "Heat-risk evidence is scattered across incompatible public datasets",
          core_workflow: "Join neighborhood data, score exposure, and inspect the highest-risk blocks",
          mvp_boundary: "One city, two datasets, and one comparison map",
          validation_plan: "Compare the resulting hotspots with a published municipal heat assessment",
        },
      },
    ],
  };

  const report = checkStructured(parsed, OPTIONS_QUALITY_SPEC);
  assert.deepEqual(report.issues, []);
});

test("ROADMAP_QUALITY_SPEC flags broken project title and step objective", () => {
  const parsed = {
    project_title: "Short",
    short_overview: "A complete overview that spans at least sixty characters for clarity.",
    project_brief: "A complete brief spanning at least one hundred and twenty characters to keep the reader grounded in context and direction.",
    steps: [
      {
        title: "A clean step title.",
        objective: "Ends with and",
        deliverable: "A concrete deliverable that reads as a complete sentence.",
        validation_check: "A concrete check that reads as a complete sentence.",
        scope_guardrail: "A concrete guardrail that reads as a complete sentence.",
      },
    ],
    cut_if_behind: ["If running behind, cut this explicit scope item."],
    success_criteria: ["You know you are done when this explicit thing is true."],
  };
  const report = checkStructured(parsed, ROADMAP_QUALITY_SPEC);
  const paths = new Set(report.issues.map((issue) => issue.path));
  assert.ok(paths.has("project_title"));
  assert.ok(paths.has("steps[0].objective"));
});

test("STEP_GUIDANCE_QUALITY_SPEC flags bad checklist bullets and email subject", () => {
  const parsed = {
    what_to_do_now: "A complete description of what to do right now that is long enough to pass.",
    encouragement: "A believable encouragement message that keeps momentum going today now.",
    checklist: ["Do the thing completely.", "too short"],
    pitfalls: ["Avoid this specific pitfall completely."],
    tools_resources: ["Use this specific tool completely."],
    done_when: ["The specific completion condition is clearly met."],
    email_version: {
      subject: "Trunc-",
      preview: "A full preview line that is complete.",
      body: "A body that is long enough to pass at least eighty characters because it describes the action in full.",
    },
  };
  const report = checkStructured(parsed, STEP_GUIDANCE_QUALITY_SPEC);
  const paths = new Set(report.issues.map((issue) => issue.path));
  assert.ok(paths.has("checklist[1]"));
  assert.ok(paths.has("email_version.subject"));
});

test("WORK_EVALUATION_QUALITY_SPEC flags short verdicts and unclean assessment", () => {
  const parsed = {
    criterion_verdicts: [
      {
        criterion: "A clear criterion label.",
        note: "A complete note that explains the verdict.",
      },
      { criterion: "bad", note: "too short" },
    ],
    overall_assessment: "A complete assessment that runs at least eighty characters for clarity of judgement on the submission overall.",
    strongest_aspect: "A complete strongest-aspect sentence for context.",
    clearest_gap: "A complete clearest-gap sentence for the reader.",
    next_best_action: "A complete next-best-action description to follow.",
  };
  const report = checkStructured(parsed, WORK_EVALUATION_QUALITY_SPEC);
  const paths = new Set(report.issues.map((issue) => issue.path));
  assert.ok(paths.has("criterion_verdicts[1].criterion"));
  assert.ok(paths.has("criterion_verdicts[1].note"));
});

test("checkStructured returns clean report for well-formed roadmap payload", () => {
  const parsed = {
    project_title: "A concrete and finishable build plan.",
    short_overview: "A complete overview that spans at least sixty characters for clarity.",
    project_brief: "A complete brief spanning at least one hundred and twenty characters to keep the reader grounded in context and direction.",
    steps: [
      {
        title: "A clean step title.",
        objective: "A fully formed objective sentence that reads cleanly and ends.",
        deliverable: "A concrete deliverable that reads as a complete sentence.",
        validation_check: "A concrete check that reads as a complete sentence.",
        scope_guardrail: "A concrete guardrail that reads as a complete sentence.",
      },
    ],
    cut_if_behind: ["If running behind, cut this explicit scope item."],
    success_criteria: ["You know you are done when this explicit thing is true."],
  };
  const report = checkStructured(parsed, ROADMAP_QUALITY_SPEC);
  assert.equal(report.severity, "clean");
  assert.deepEqual(report.issues, []);
});
