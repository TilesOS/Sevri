import assert from "node:assert/strict";
import test from "node:test";
import { runSafetyChecks, type PublicPortfolioSafetyInput } from "./index.ts";

const cleanInput: PublicPortfolioSafetyInput = {
  displayName: "A Sevri student",
  projectTitle: "Neighborhood Transit Notebook",
  summary: "Built a small tool for comparing transit notes and reflecting on route design choices.",
  reflection: "I learned how to narrow a project into a usable artifact.",
  featuredSubmissionExcerpt: "The prototype compares route notes and highlights recurring issues.",
  featuredArtifactDisplayNames: "prototype.pdf",
  featuredEvidenceText: "Prototype after the third test — A small model on a table.",
};

test("safety checks pass for a clean public portfolio surface", () => {
  const result = runSafetyChecks(cleanInput);
  assert.equal(result.passed, true);
  assert.deepEqual(result.findings, []);
});

test("safety checks flag PII with short excerpts", () => {
  const result = runSafetyChecks({
    ...cleanInput,
    reflection: "Reach me at student@example.com about the prototype.",
  });

  assert.equal(result.passed, false);
  const pii = result.findings.find((finding) => finding.kind === "pii");
  assert.ok(pii);
  assert.equal(pii.field, "reflection");
  assert.ok((pii.excerpt ?? "").length <= 20);
});

test("safety checks flag profanity from the vendored wordlist", () => {
  const result = runSafetyChecks({
    ...cleanInput,
    featuredSubmissionExcerpt: "This prototype removed the damn confusing labels.",
  });

  assert.equal(result.passed, false);
  assert.ok(result.findings.some((finding) => finding.kind === "profanity"));
});

test("safety checks flag public field bounds", () => {
  const result = runSafetyChecks({
    ...cleanInput,
    projectTitle: "AI",
    summary: "Too short.",
  });

  assert.equal(result.passed, false);
  assert.ok(result.findings.some((finding) => finding.kind === "bounds" && finding.field === "projectTitle"));
  assert.ok(result.findings.some((finding) => finding.kind === "bounds" && finding.field === "summary"));
});
