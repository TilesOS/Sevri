import { trackEvent } from "@/lib/analytics/track";
import { getRouteGenerationMetadata, runPortfolioCuration } from "@/lib/ai/pipelines";
import {
  markPortfolioCurationAttempted,
  savePortfolioCuration,
} from "@/lib/db/mutations/portfolio";
import {
  getPortfolioEntryDetailData,
  type PortfolioEntryRow,
} from "@/lib/db/queries/portfolio";
import { buildPortfolioPipelineInputFromDetailData } from "@/lib/portfolio/ai-context";
import { isEligibleForFirstTimeCuration } from "@/lib/portfolio/portfolio-view-model";
import { runSafetyChecks } from "@/lib/portfolio/safety";

// Curation is one AI call per entry, run inline while the page renders. Cap the
// batch so a student with many projects does not wait on a long serial run;
// the remainder is picked up on the next visit.
const MAX_FIRST_TIME_CURATIONS_PER_REQUEST = 3;

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
}) {
  const startedAt = performance.now();
  const data = await getPortfolioEntryDetailData(input.projectId, input.userId);
  if (!data) {
    return null;
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
      featuredSubmissionExcerpt: (data.latestSubmissions[0]?.submission_text ?? "").slice(0, 300),
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

export async function runFirstTimePortfolioCurationForPendingEntries(input: {
  userId: string;
  entries: Array<{
    entry: PortfolioEntryRow;
    project: { id: string };
  }>;
}) {
  let attempted = 0;

  for (const item of input.entries) {
    if (attempted >= MAX_FIRST_TIME_CURATIONS_PER_REQUEST) {
      break;
    }

    if (!isEligibleForFirstTimeCuration(item.entry)) {
      continue;
    }

    attempted += 1;

    try {
      const result = await generateAndSavePortfolioCuration({
        projectId: item.project.id,
        userId: input.userId,
        source: "first_time",
      });

      if (result?.blocked) {
        await markPortfolioCurationAttempted({
          entryId: item.entry.id,
          userId: input.userId,
          metadata: {
            source: "first_time",
            blocked: true,
            findings: result.findings,
          },
        });
      }
    } catch (error) {
      await markPortfolioCurationAttempted({
        entryId: item.entry.id,
        userId: input.userId,
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
}
