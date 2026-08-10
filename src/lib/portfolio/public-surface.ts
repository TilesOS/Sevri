import type { PublicPortfolioSafetyInput } from "@/lib/portfolio/safety";
import type { PortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";
import { truncateProse } from "@/lib/text/prose";

export function trimPublicText(value: string | null | undefined, maxLength: number) {
  return truncateProse(value, maxLength);
}

export function getPublicFeaturedSubmissionExcerpt(view: PortfolioEntryDetailView) {
  const featured = view.featuredSubmission ?? view.latestSubmissions[0] ?? null;
  return trimPublicText(featured?.submission_text, 300);
}

export function buildPublicSafetyInput(
  view: PortfolioEntryDetailView,
  displayName: string,
): PublicPortfolioSafetyInput {
  return {
    displayName,
    projectTitle: view.project.title,
    summary: view.summary,
    reflection: view.entry.student_reflection ?? "",
    featuredSubmissionExcerpt: getPublicFeaturedSubmissionExcerpt(view),
    featuredEvidenceText: view.artifacts
      .filter((artifact) => view.featuredArtifactIds.includes(artifact.id))
      .map((artifact) => [artifact.caption, artifact.alt_text].filter(Boolean).join(" — "))
      .join("\n"),
  };
}
