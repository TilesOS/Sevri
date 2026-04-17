import assert from "node:assert/strict";
import test from "node:test";
import {
  applyStructuredCleanup,
  buildRepairFeedback,
  checkField,
  checkStructured,
  safeRenderText,
  type FieldSpec,
} from "./content-quality.ts";

const TITLE_SPEC: FieldSpec = { kind: "title", minCredible: 8, maxUiSafe: 100 };
const PROSE_SPEC: FieldSpec = { kind: "prose", minCredible: 24 };
const BULLET_SPEC: FieldSpec = { kind: "bullet", minCredible: 16 };

function kinds(issues: ReturnType<typeof checkField>): string[] {
  return issues.map((issue) => issue.kind);
}

test("checkField flags mid-word hyphen truncation", () => {
  const issues = checkField("Build a robot that learns to rec-", "path", TITLE_SPEC);
  assert.ok(kinds(issues).includes("mid_word_end"));
});

test("checkField is clean for a well-formed title", () => {
  const issues = checkField("Ship a focused prototype", "path", TITLE_SPEC);
  assert.deepEqual(kinds(issues), []);
});

test("checkField flags trailing connectors", () => {
  const issues = checkField("Ship an MVP and", "path", PROSE_SPEC);
  assert.ok(kinds(issues).includes("trailing_connector"));
});

test("checkField flags mojibake with replacement char", () => {
  const issues = checkField("caf\uFFFD opening notes - a complete sentence.", "path", PROSE_SPEC);
  assert.ok(kinds(issues).includes("mojibake"));
});

test("checkField flags UTF-8 double-encoded mojibake", () => {
  const issues = checkField("The caf\u00C3\u00A9 is open every morning at seven.", "path", PROSE_SPEC);
  assert.ok(kinds(issues).includes("mojibake"));
});

test("checkField flags non-Latin script contamination", () => {
  const issues = checkField(
    "Ship an MVP \u6211\u4EEC quickly and finish it well.",
    "path",
    PROSE_SPEC,
  );
  assert.ok(kinds(issues).includes("language_contamination"));
});

test("checkField ignores technical terms in the allowlist", () => {
  const issues = checkField("Ship the GPU-bound pipeline next.", "path", PROSE_SPEC, {
    allowedTerms: ["GPU"],
  });
  assert.ok(!kinds(issues).includes("language_contamination"));
});

test("checkField allows custom proper nouns passed through allowedTerms", () => {
  const issues = checkField(
    "Raspberry Pi is central to the build and the wiring.",
    "path",
    PROSE_SPEC,
    { allowedTerms: ["Raspberry Pi"] },
  );
  assert.ok(!kinds(issues).includes("language_contamination"));
});

test("checkField flags unbalanced quote pairs", () => {
  const issues = checkField('He said "go but never finished the thought.', "path", PROSE_SPEC);
  assert.ok(kinds(issues).includes("unbalanced_pair"));
});

test("checkField flags prose missing terminal punctuation", () => {
  const issues = checkField("A complete thought without the final stop", "path", PROSE_SPEC);
  assert.ok(kinds(issues).includes("missing_terminal_punct"));
});

test("checkField flags bullets missing terminal punctuation", () => {
  const issues = checkField("Do the thing and move on", "path", BULLET_SPEC);
  assert.ok(kinds(issues).includes("missing_terminal_punct"));
});

test("checkField flags titles exceeding UI budget", () => {
  const long = "A".repeat(120);
  const issues = checkField(long, "path", TITLE_SPEC);
  assert.ok(kinds(issues).includes("too_long_title"));
});

test("checkField flags short content below minCredible", () => {
  const issues = checkField("short.", "path", PROSE_SPEC);
  assert.ok(kinds(issues).includes("too_short"));
});

test("checkField flags empty strings", () => {
  const issues = checkField("   ", "path", PROSE_SPEC);
  assert.deepEqual(kinds(issues), ["empty_or_whitespace"]);
});

test("checkField flags dangling colon", () => {
  const issues = checkField("Write the project brief in full sentences:", "path", PROSE_SPEC);
  assert.ok(kinds(issues).includes("dangling_colon_dash"));
});

test("checkField returns no issues for non-string input", () => {
  const issues = checkField(undefined, "path", PROSE_SPEC);
  assert.deepEqual(issues, []);
});

test("checkStructured walks nested arrays and objects using wildcard specs", () => {
  const parsed = {
    steps: [
      { title: "Clean title here.", body: "Not checked" },
      { title: "Ends with a hyphen cut-", body: "Not checked" },
    ],
  };
  const report = checkStructured(parsed, { "steps[*].title": TITLE_SPEC });
  assert.equal(report.severity, "repairable");
  assert.ok(report.issues.length >= 1);
  assert.ok(report.issues.every((issue) => issue.path === "steps[1].title"));
});

test("checkStructured marks mojibake as fatal severity", () => {
  const report = checkStructured(
    { field: "Contains \uFFFD characters in a prose block." },
    { field: PROSE_SPEC },
  );
  assert.equal(report.severity, "fatal");
});

test("buildRepairFeedback groups issues per path", () => {
  const report = checkStructured(
    { title: "Ends with and", overview: "Missing stop" },
    { title: TITLE_SPEC, overview: PROSE_SPEC },
  );
  const lines = buildRepairFeedback(report);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes("title"));
  assert.ok(lines[1].includes("overview"));
});

test("safeRenderText strips mojibake and marks degraded", () => {
  const out = safeRenderText("caf\uFFFD\uFFFD opens at seven.", PROSE_SPEC);
  assert.equal(out.degraded, true);
  assert.ok(!out.text.includes("\uFFFD"));
});

test("safeRenderText snaps prose back to last sentence boundary", () => {
  const out = safeRenderText("First complete sentence. Second one that is cut off and", PROSE_SPEC);
  assert.equal(out.degraded, true);
  assert.equal(out.text, "First complete sentence.");
});

test("safeRenderText drops trailing connectors from titles", () => {
  const out = safeRenderText("Ship an MVP and", TITLE_SPEC);
  assert.equal(out.degraded, true);
  assert.ok(!/\band$/iu.test(out.text));
});

test("safeRenderText drops trailing colon", () => {
  const out = safeRenderText("Here is the plan:", PROSE_SPEC);
  assert.equal(out.degraded, true);
  assert.ok(out.text.endsWith("."));
  assert.ok(!out.text.endsWith(":."));
});

test("safeRenderText truncates titles exceeding maxUiSafe on a word boundary", () => {
  const long = "word ".repeat(40).trim();
  const out = safeRenderText(long, TITLE_SPEC);
  assert.equal(out.degraded, true);
  assert.ok(out.text.length <= 100);
  assert.ok(!out.text.endsWith(" "));
});

test("safeRenderText leaves clean prose unchanged", () => {
  const out = safeRenderText("A complete sentence that ends correctly.", PROSE_SPEC);
  assert.equal(out.degraded, false);
  assert.equal(out.text, "A complete sentence that ends correctly.");
});

test("applyStructuredCleanup rewrites only flagged paths", () => {
  const parsed = {
    steps: [
      { title: "Clean title." },
      { title: "Ends with and" },
    ],
  };
  const { cleaned, changedPaths } = applyStructuredCleanup(parsed, {
    "steps[*].title": TITLE_SPEC,
  });
  assert.deepEqual(changedPaths, ["steps[1].title"]);
  assert.equal(cleaned.steps[0].title, "Clean title.");
  assert.notEqual(cleaned.steps[1].title, "Ends with and");
  assert.equal(parsed.steps[1].title, "Ends with and"); // original untouched
});

test("applyStructuredCleanup leaves unspecced paths alone", () => {
  const parsed = { ignored: "Ends with and", title: "Clean title." };
  const { cleaned, changedPaths } = applyStructuredCleanup(parsed, { title: TITLE_SPEC });
  assert.deepEqual(changedPaths, []);
  assert.equal(cleaned.ignored, "Ends with and");
});
