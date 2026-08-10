import assert from "node:assert/strict";
import test from "node:test";
import {
  NEW_PROJECT_CTA,
  PROJECT_SECTION_LABELS,
  WORKSPACE_LABELS,
  collapseLabel,
  projectPath,
  stepLabel,
} from "./glossary.ts";

// DES-017: the disclosure kept saying "Show step detail" while the detail was
// already on screen.
test("an instruction label flips to its opposite", () => {
  assert.equal(collapseLabel("Show step detail"), "Hide step detail");
  assert.equal(collapseLabel("View full details"), "Hide full details");
  assert.equal(collapseLabel("Open the export steps"), "Hide the export steps");
  assert.equal(collapseLabel("Expand notes"), "Hide notes");
});

test("a label that is not an instruction is left alone", () => {
  assert.equal(collapseLabel("Archived (3)"), "Archived (3)");
  assert.equal(collapseLabel("GitHub commits"), "GitHub commits");
  assert.equal(collapseLabel("Show"), "Show");
});

test("roadmap items are steps, never milestones", () => {
  assert.equal(stepLabel(4), "Step 4");
  assert.equal(stepLabel("12"), "Step 12");
});

// DES-011: one name per concept. These assertions are the product decision, so a
// future rename has to be made deliberately rather than drifting per surface.
test("the glossary holds the agreed names", () => {
  assert.equal(PROJECT_SECTION_LABELS.scope, "Scope & Guardrails");
  assert.equal(PROJECT_SECTION_LABELS.lens, "Project Lens");
  assert.equal(PROJECT_SECTION_LABELS.pitchKit, "Pitch Kit");
  assert.equal(WORKSPACE_LABELS.ideas, "Project ideas");
  assert.equal(NEW_PROJECT_CTA, "New project");
});

test("no label reintroduces a retired term", () => {
  const labels = [
    ...Object.values(PROJECT_SECTION_LABELS),
    ...Object.values(WORKSPACE_LABELS),
    NEW_PROJECT_CTA,
  ];

  for (const label of labels) {
    assert.ok(!/milestone/i.test(label), `"${label}" should say step, not milestone`);
    assert.ok(!/presentation/i.test(label), `"${label}" should say Pitch Kit, not Presentation`);
  }
});

test("project paths use the canonical singular prefix", () => {
  assert.equal(projectPath("abc"), "/project/abc");
  assert.equal(projectPath("abc", "focus"), "/project/abc/focus");
  assert.ok(!projectPath("abc", "focus").startsWith("/projects/"));
});
