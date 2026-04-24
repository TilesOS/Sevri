import { trackEvent } from "@/lib/analytics/track";
import {
  getRouteGenerationMetadata,
  runCommonAppActivityExport,
  runResumeBulletsExport,
} from "@/lib/ai/pipelines";
import { upsertPortfolioExport } from "@/lib/db/mutations/portfolio";
import {
  getPortfolioEntryDetailData,
  type PortfolioExportFormat,
} from "@/lib/db/queries/portfolio";
import { buildPortfolioPipelineInputFromDetailData } from "@/lib/portfolio/ai-context";
import type { CommonAppActivity, ResumeBullets } from "@/lib/ai/schemas";

function formatCommonAppActivityExport(activity: CommonAppActivity) {
  return [
    `Activity type: ${activity.activity_type}`,
    `Position/leadership: ${activity.position_leadership_description}`,
    `Organization: ${activity.organization_name}`,
    `Grades: ${activity.participation_grade_levels}`,
    `Timing: ${activity.timing_of_participation}`,
    `Hours/week: ${activity.hours_per_week}`,
    `Weeks/year: ${activity.weeks_per_year}`,
    `Details: ${activity.details}`,
  ].join("\n");
}

function formatResumeBulletsExport(resume: ResumeBullets) {
  return resume.bullets.map((bullet) => `- ${bullet}`).join("\n");
}

export async function generateAndSavePortfolioExport(input: {
  projectId: string;
  userId: string;
  format: PortfolioExportFormat;
}) {
  const startedAt = performance.now();
  const data = await getPortfolioEntryDetailData(input.projectId, input.userId);
  if (!data) {
    return null;
  }

  const pipelineInput = buildPortfolioPipelineInputFromDetailData(data);
  const generated =
    input.format === "common_app_activity"
      ? await runCommonAppActivityExport(pipelineInput)
      : await runResumeBulletsExport(pipelineInput);
  const metadata = getRouteGenerationMetadata({
    metrics: generated.metrics,
    routeTotalMs: performance.now() - startedAt,
    cacheHit: false,
  });
  const exportText =
    input.format === "common_app_activity"
      ? formatCommonAppActivityExport(generated.parsed as CommonAppActivity)
      : formatResumeBulletsExport(generated.parsed as ResumeBullets);

  const exportRow = await upsertPortfolioExport({
    entryId: data.entry.id,
    userId: input.userId,
    format: input.format,
    exportJson: generated.parsed,
    exportText,
    metadata,
  });

  await trackEvent(input.userId, "portfolio_export_generated", {
    project_id: input.projectId,
    portfolio_entry_id: data.entry.id,
    export_format: input.format,
    ...metadata,
  });

  return {
    export: exportRow,
    generated,
  };
}
