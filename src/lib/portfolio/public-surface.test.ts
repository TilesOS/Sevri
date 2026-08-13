import assert from "node:assert/strict";
import test from "node:test";
import { getPublicFeaturedArtifactDisplayNames } from "./featured-evidence.ts";
import { runSafetyChecks, type PublicPortfolioSafetyInput } from "./safety/index.ts";

test("featured artifact display names are included in publishing safety checks", () => {
  const featuredArtifactDisplayNames = getPublicFeaturedArtifactDisplayNames([
    {
      id: "featured",
      display_name: "student@example.com.pdf",
    },
    {
      id: "private",
      display_name: "private@example.com.pdf",
    },
  ], ["featured"]);

  assert.match(featuredArtifactDisplayNames, /student@example\.com\.pdf/);
  assert.doesNotMatch(featuredArtifactDisplayNames, /private@example\.com\.pdf/);

  const input: PublicPortfolioSafetyInput = {
    displayName: "A Sevri student",
    projectTitle: "Neighborhood Transit Notebook",
    summary: "Built a small tool for comparing transit notes and reflecting on route design choices.",
    reflection: "I learned how to narrow a project into a usable artifact.",
    featuredSubmissionExcerpt: "The prototype compares route notes.",
    featuredArtifactDisplayNames,
    featuredEvidenceText: "Final report — A PDF report",
  };
  const result = runSafetyChecks(input);

  assert.equal(result.passed, false);
  assert.ok(result.findings.some((finding) =>
    finding.kind === "pii" && finding.field === "featuredArtifactDisplayNames"
  ));
});
