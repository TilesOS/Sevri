import { cache } from "react";
import {
  getPortfolioEntryDetailData,
  getPortfolioListingData,
} from "@/lib/db/queries/portfolio";
import {
  buildPortfolioEntryDetailViewFromData,
  buildPortfolioViewFromData,
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
  return buildPortfolioViewFromData(await getPortfolioListingData(userId));
});

export const getPortfolioEntryDetailView = cache(
  async (projectId: string, userId: string): Promise<PortfolioEntryDetailView | null> => {
    const data = await getPortfolioEntryDetailData(projectId, userId);
    if (!data) {
      return null;
    }

    return buildPortfolioEntryDetailViewFromData(data);
  },
);
