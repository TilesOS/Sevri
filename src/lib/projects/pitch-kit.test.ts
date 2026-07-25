import assert from "node:assert/strict";
import test from "node:test";
import { formatLintIssues, lintProse } from "../text/content-lint.ts";
import {
  composePitchKitDraft,
  composeScopeStatement,
  formatTalkingPoint,
  isUsableStoredCopy,
  parseTalkingPoint,
  toDeferral,
  toDeferralList,
} from "./pitch-kit.ts";

function assertClean(label: string, value: string) {
  const issues = lintProse(value);
  assert.deepEqual(
    issues,
    [],
    `${label} should be clean but was: ${formatLintIssues(issues)}\n  → ${value}`,
  );
}

/**
 * Representative seeds. Each carries a field shape that broke the old templates:
 * a workflow written as a full sentence, a research question ending in "?", and
 * a deliverable that already ends in a period.
 */
const SOFTWARE_SEED = {
  target_user: "Students validating photonics experiments",
  problem_statement: "Loss measurements are scattered across notebooks and are hard to compare.",
  core_workflow: "The app walks the user through loading a sweep, comparing runs, and saving the result.",
  mvp_boundary: "One sweep type and one comparison view are in scope; batch imports are out.",
  validation_plan: "Run the tool on three real sweeps and confirm a peer can read the output.",
};

const RESEARCH_SEED = {
  research_question: "What most strongly drives propagation loss in silicon waveguides?",
  hypothesis_or_focus: "Sidewall roughness dominates loss more than doping level does.",
  methodology: "Secondary data analysis.",
  evidence_plan: "Use one published waveguide dataset with reported loss and geometry.",
  scope_boundaries: "One factor, one dataset, and one outcome measure are in scope.",
  limitation_note: "Findings are correlational within a single dataset.",
};

test("software scope statement gives each stored field its own sentence", () => {
  const scope = composeScopeStatement({ projectTrack: "software", seed: SOFTWARE_SEED });
  assertClean("software scope", scope);
  // The old template produced "centered on The app walks the user... and avoid feature creep".
  assert.ok(scope.includes("The app walks the user through"));
  assert.ok(!scope.includes("centered on the app walks"));
});

test("research scope statement survives a question-mark field", () => {
  const scope = composeScopeStatement({ projectTrack: "research", seed: RESEARCH_SEED });
  assertClean("research scope", scope);
  assert.ok(scope.includes("silicon waveguides?"));
});

test("scope statement stays clean when the seed is empty", () => {
  assertClean("empty software scope", composeScopeStatement({ projectTrack: "software", seed: {} }));
  assertClean("empty research scope", composeScopeStatement({ projectTrack: "research", seed: {} }));
});

test("software pitch kit draft is clean prose throughout", () => {
  const kit = composePitchKitDraft({
    projectTrack: "software",
    projectTitle: "Waveguide Loss Explorer",
    seed: SOFTWARE_SEED,
    firstDeliverable: "A product scope brief with a success rubric.",
    stepCount: 5,
    whyItFits: "The student's photonics background gives them a real reason to own this problem.",
  });

  assert.equal(kit.isDraft, true);
  assertClean("elevator pitch", kit.elevatorPitch);
  kit.resumeBullets.forEach((bullet, index) => assertClean(`resume bullet ${index}`, bullet));
  kit.talkingPoints.forEach((point, index) => assertClean(`talking point ${index}`, point.body));
  assert.equal(kit.talkingPoints.length, 3);
});

test("research pitch kit draft is clean prose throughout", () => {
  const kit = composePitchKitDraft({
    projectTrack: "research",
    projectTitle: "Silicon Waveguide Loss Study",
    seed: RESEARCH_SEED,
    firstDeliverable: "A one-page question and scope brief.",
    stepCount: 5,
    whyItFits: "It gives the student a believable question they can defend with their own evidence.",
  });

  assert.equal(kit.isDraft, true);
  assertClean("elevator pitch", kit.elevatorPitch);
  kit.resumeBullets.forEach((bullet, index) => assertClean(`resume bullet ${index}`, bullet));
  kit.talkingPoints.forEach((point, index) => assertClean(`talking point ${index}`, point.body));
});

test("pitch kit draft rewrites a third-person rationale into second person", () => {
  const kit = composePitchKitDraft({
    projectTrack: "software",
    projectTitle: "Waveguide Loss Explorer",
    seed: SOFTWARE_SEED,
    whyItFits: "The student's photonics background gives them a real reason to own this problem.",
  });
  const why = kit.talkingPoints.find((point) => point.label === "Why this project");
  assert.ok(why);
  assert.ok(!/the student/iu.test(why.body));
  assert.ok(/\byour\b/iu.test(why.body));
});

test("pitch kit draft stays clean with a sparse seed and no title", () => {
  const kit = composePitchKitDraft({ projectTrack: "software", projectTitle: "", seed: {} });
  assertClean("sparse elevator pitch", kit.elevatorPitch);
  kit.resumeBullets.forEach((bullet, index) => assertClean(`sparse bullet ${index}`, bullet));
  kit.talkingPoints.forEach((point, index) => assertClean(`sparse point ${index}`, point.body));
});

test("a long sentence-shaped audience is not inlined mid-sentence", () => {
  const kit = composePitchKitDraft({
    projectTrack: "software",
    projectTitle: "Trace Explorer",
    seed: {
      ...SOFTWARE_SEED,
      target_user:
        "Anyone who has ever had to compare two runs by hand. They usually give up and guess.",
    },
  });
  kit.resumeBullets.forEach((bullet, index) => assertClean(`bullet ${index}`, bullet));
});

test("deferrals drop the redundant prefix that older rows carry", () => {
  assert.equal(
    toDeferral("Stretch later: Visual polish beyond basic usability"),
    "Later: Visual polish beyond basic usability.",
  );
});

test("deferrals drop cut-now imperatives and their continuation clause", () => {
  assert.equal(
    toDeferral("Skip extra integrations and keep the data source manual or local."),
    "Later: Extra integrations.",
  );
  assert.equal(
    toDeferral("Drop secondary analyses and keep the write-up centered on one finding."),
    "Later: Secondary analyses.",
  );
});

test("deferrals keep a plain noun phrase intact", () => {
  assert.equal(
    toDeferral("Secondary workflows beyond the core flow"),
    "Later: Secondary workflows beyond the core flow.",
  );
});

test("deferral list de-duplicates and drops empties", () => {
  const list = toDeferralList([
    "Stretch later: Visual polish",
    "Later: visual polish",
    "   ",
    "Cut the export view",
  ]);
  assert.deepEqual(list, ["Later: Visual polish.", "Later: The export view."]);
});

test("every deferral is clean prose", () => {
  const list = toDeferralList([
    "Delay polish features until the main workflow is demo-ready.",
    "Remove the second comparison axis",
    "User accounts if not essential to the core workflow",
  ]);
  list.forEach((item, index) => assertClean(`deferral ${index}`, item));
});

test("talking points round-trip through storage formatting", () => {
  const point = { label: "What it does", body: "The tool ranks hotspots by measured loss." };
  const formatted = formatTalkingPoint(point);
  assert.equal(formatted, "What it does: The tool ranks hotspots by measured loss.");
  assert.deepEqual(parseTalkingPoint(formatted), point);
});

test("a body ending in a question mark still formats correctly", () => {
  const formatted = formatTalkingPoint({
    label: "What it investigates",
    body: "What most strongly drives propagation loss in silicon waveguides?",
  });
  assertClean("question talking point", formatted);
  assert.ok(formatted.endsWith("?"));
});

test("stored copy triage accepts clean prose and rejects stitched prose", () => {
  assert.equal(isUsableStoredCopy("Your MVP is one workflow, start to finish."), true);
  assert.equal(
    isUsableStoredCopy("Keep the MVP centered on the app walks the user through it. and avoid creep."),
    false,
  );
  assert.equal(isUsableStoredCopy(""), false);
  assert.equal(isUsableStoredCopy(null), false);
});
