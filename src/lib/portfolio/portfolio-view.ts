import { cache } from "react";
import {
  getPortfolioEntryDetailData,
  getPortfolioListingData,
} from "@/lib/db/queries/portfolio";
import {
  ensurePortfolioEntriesForUserProjects,
  ensurePortfolioEntryForProject,
} from "@/lib/db/mutations/portfolio";
import { runFirstTimePortfolioCurationForPendingEntries } from "@/lib/portfolio/curation";
import {
  buildPortfolioEntryDetailViewFromData,
  buildPortfolioViewFromData,
  isEligibleForFirstTimeCuration,
  type PortfolioEntryDetailView,
  type PortfolioView,
} from "@/lib/portfolio/portfolio-view-model";

export {
  FIRST_TIME_CURATION_RETRY_COOLDOWN_MS,
  buildPortfolioEntryDetailViewFromData,
  buildPortfolioViewFromData,
  getPortfolioCurationState,
  getPortfolioStatusLabel,
  isEligibleForFirstTimeCuration,
} from "@/lib/portfolio/portfolio-view-model";

export type {
  PortfolioCachedCommitView,
  PortfolioCurationState,
  PortfolioEntryDetailView,
  PortfolioListingEntryView,
  PortfolioStatus,
  PortfolioView,
} from "@/lib/portfolio/portfolio-view-model";

export const getPortfolioView = cache(async (userId: string): Promise<PortfolioView> => {
  await ensurePortfolioEntriesForUserProjects(userId);

  const initialData = await getPortfolioListingData(userId);
  const initialView = buildPortfolioViewFromData(initialData);
  const pendingFirstCuration = initialView.entries.filter((entry) =>
    isEligibleForFirstTimeCuration(entry.entry),
  );

  if (pendingFirstCuration.length > 0) {
    await runFirstTimePortfolioCurationForPendingEntries({
      userId,
      entries: pendingFirstCuration,
    });

    return buildPortfolioViewFromData(await getPortfolioListingData(userId));
  }

  return initialView;
});

export const getPortfolioEntryDetailView = cache(
  async (projectId: string, userId: string): Promise<PortfolioEntryDetailView | null> => {
    const ensuredEntry = await ensurePortfolioEntryForProject(projectId, userId);
    if (!ensuredEntry) {
      return null;
    }

    const data = await getPortfolioEntryDetailData(projectId, userId);
    if (!data) {
      return null;
    }

    if (isEligibleForFirstTimeCuration(data.entry)) {
      await runFirstTimePortfolioCurationForPendingEntries({
        userId,
        entries: [{ entry: data.entry, project: { id: data.project.id } }],
      });

      const refreshedData = await getPortfolioEntryDetailData(projectId, userId);
      if (refreshedData) {
        return buildPortfolioEntryDetailViewFromData(refreshedData);
      }
    }

    return buildPortfolioEntryDetailViewFromData(data);
  },
);
