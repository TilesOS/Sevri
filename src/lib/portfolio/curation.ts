import { trackEvent } from "@/lib/analytics/track";
import { getRouteGenerationMetadata, runPortfolioCuration } from "@/lib/ai/pipelines";
import {
  markPortfolioCurationAttempted,
  savePortfolioCuration,
  type PortfolioCurationClaim,
} from "@/lib/db/mutations/portfolio";
import { getPortfolioEntryDetailData } from "@/lib/db/queries/portfolio";
import { buildPortfolioPipelineInputFromDetailData } from "@/lib/portfolio/ai-context";
import { trimPublicText } from "@/lib/portfolio/public-surface";
import { runSafetyChecks } from "@/lib/portfolio/safety";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isLivePublicPage(publicPage: { published_at: string | null; unpublished_at: string | null } | null) {
  return Boolean(publicPage?.published_at && !publicPage.unpublished_at);
}

export async function generateAndSavePortfolioCuration(input: {
  projectId: string;
  userId: string;
  source: "first_time" | "regenerate";
  claim?: Pick<PortfolioCurationClaim, "entryId" | "claimToken">;
}) {
  const startedAt = performance.now();
  const data = await getPortfolioEntryDetailData(input.projectId, input.userId);
  if (!data) {
    return null;
  }
  if (input.claim && data.entry.id !== input.claim.entryId) {
    throw new Error("Portfolio curation claim no longer matches the project entry.");
  }

  const pipelineInput = buildPortfolioPipelineInputFromDetailData(data);
  const generated = await runPortfolioCuration(pipelineInput);
  const metadata = getRouteGenerationMetadata({
    metrics: generated.metrics,
    routeTotalMs: performance.now() - startedAt,
    cacheHit: false,
  });

  if (isLivePublicPage(data.publicPage)) {
    const safety = runSafetyChecks({
      displayName: "A Sevri student",
      projectTitle: data.project.title,
      summary: generated.parsed.curated_summary,
      reflection: data.entry.student_reflection ?? "",
      featuredSubmissionExcerpt: trimPublicText(
        data.latestSubmissions[0]?.submission_text,
        300,
      ),
      featuredArtifactDisplayNames: "",
      featuredEvidenceText: "",
    });
    if (!safety.passed) {
      return {
        blocked: true as const,
        entry: data.entry,
        findings: safety.findings,
      };
    }
  }

  const entry = await savePortfolioCuration({
    entryId: data.entry.id,
    userId: input.userId,
    curatedSummary: generated.parsed.curated_summary,
    model: generated.metrics.model,
    metadata: {
      ...metadata,
      source: input.source,
    },
    claimToken: input.claim?.claimToken,
  });

  await trackEvent(
    input.userId,
    input.source === "regenerate" ? "portfolio_curation_regenerated" : "portfolio_curation_generated",
    {
      project_id: input.projectId,
      portfolio_entry_id: data.entry.id,
      ...metadata,
    },
  );

  return {
    blocked: false as const,
    entry,
    generated,
  };
}

export async function runClaimedFirstTimePortfolioCurations(input: {
  userId: string;
  claims: PortfolioCurationClaim[];
}) {
  let completed = 0;

  for (const claim of input.claims) {
    try {
      const result = await generateAndSavePortfolioCuration({
        projectId: claim.projectId,
        userId: input.userId,
        source: "first_time",
        claim,
      });

      if (!result) {
        throw new Error("Portfolio entry was not found after its curation claim.");
      }

      if (result.blocked) {
        await markPortfolioCurationAttempted({
          entryId: claim.entryId,
          userId: input.userId,
          claimToken: claim.claimToken,
          metadata: {
            source: "first_time",
            blocked: true,
            findings: result.findings,
          },
        });
      } else {
        completed += 1;
      }
    } catch (error) {
      await markPortfolioCurationAttempted({
        entryId: claim.entryId,
        userId: input.userId,
        claimToken: claim.claimToken,
        metadata: {
          source: "first_time",
          failed: true,
          error: getErrorMessage(error),
        },
      }).catch((markError) => {
        console.error("failed to mark portfolio curation attempt", markError);
      });
    }
  }

  return { completed, attempted: input.claims.length };
}
