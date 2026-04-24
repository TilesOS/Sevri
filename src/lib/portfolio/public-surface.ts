import type { PublicPortfolioSafetyInput } from "@/lib/portfolio/safety";
import type { PortfolioEntryDetailView } from "@/lib/portfolio/portfolio-view";

export function trimPublicText(value: string | null | undefined, maxLength: number) {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  return clean.slice(0, maxLength).trim();
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
  };
}
