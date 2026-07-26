import assert from "node:assert/strict";
import test from "node:test";
import { formatLintIssues, isCleanProse, lintProse } from "./content-lint.ts";

function codes(value: string, options?: Parameters<typeof lintProse>[1]): string[] {
  return lintProse(value, options).map((issue) => issue.code);
}

// Each case below is an artifact observed in the shipped product.

test("catches a sentence stitched to a trailing connector", () => {
  const observed =
    "Keep the MVP centered on the app walks the user through the flow. and avoid optional feature creep.";
  assert.ok(codes(observed).includes("stitched_period_connector"));
});

test("catches a question mark stitched to a continuation clause", () => {
  const observed =
    "Waveguide Study is a focused research plan centered on what drives loss in silicon waveguides? with a practical, student-scale evidence path.";
  assert.ok(codes(observed).includes("stitched_question_mark"));
});

test("catches a doubled period from a slotted sentence", () => {
  const observed =
    "Built the Trace Explorer to address build a comparison tool, the demo is tuned for interview walkthroughs..";
  assert.ok(codes(observed).includes("double_terminal_punctuation"));
});

test("catches a sentence that starts lowercase after a period", () => {
  const observed = "Scoped the MVP around a one-page brief. and validated progress against milestones.";
  const found = codes(observed);
  assert.ok(found.includes("lowercase_after_period"));
  assert.ok(found.includes("stitched_period_connector"));
});

test("catches copy that trails off on a preposition", () => {
  const observed = "This project leverages your math and programming strengths to";
  assert.ok(codes(observed).includes("trailing_preposition"));
});

test("catches internal vocabulary addressed to the student", () => {
  const observed = "This project directly addresses Sevri's target outcome for the semester.";
  assert.ok(codes(observed).includes("internal_vocabulary"));
});

test("catches third-person references to the reader", () => {
  const observed = "The student can handle a structured method if the scope stays narrow.";
  assert.ok(codes(observed).includes("third_person_student"));
});

test("catches zero-width characters", () => {
  assert.ok(codes("Limitation: the study is bounded.\u200B").includes("zero_width_character"));
});

test("catches a non-Latin character fused to an English word", () => {
  assert.ok(codes("Resolve the alias\u5225 before you continue.").includes("mixed_script"));
});

test("allows non-Latin script that the caller declared as a term", () => {
  const found = codes("Compare the \u6F22\u5B57 tokenizer against the baseline.", {
    allowedTerms: ["\u6F22\u5B57"],
  });
  assert.ok(!found.includes("mixed_script"));
});

test("catches an unfilled template slot", () => {
  assert.ok(codes("Built {title} for {audience}.").includes("template_placeholder"));
});

test("passes clean second-person prose", () => {
  const clean =
    "Your MVP is one workflow, start to finish. The tool turns a raw trace into a ranked list of hotspots. Anything outside that boundary waits until the core workflow works.";
  assert.deepEqual(lintProse(clean), []);
});

test("does not flag a capitalized connector that legitimately starts a sentence", () => {
  const clean = "Ship the comparison view first. Then write the demo script.";
  assert.deepEqual(lintProse(clean), []);
});

test("does not flag periods inside common abbreviations", () => {
  const clean = "Start with one accessible source, e.g. a public dataset you can cite.";
  assert.deepEqual(lintProse(clean), []);
});

test("titles may opt out of the terminal-punctuation rule", () => {
  assert.ok(!isCleanProse("Wire the trace parser"));
  assert.ok(isCleanProse("Wire the trace parser", { requireTerminalPunctuation: false }));
});

test("formatLintIssues renders codes with their matched text", () => {
  const formatted = formatLintIssues(lintProse("Scoped the MVP. and moved on."));
  assert.ok(formatted.includes("stitched_period_connector"));
});
