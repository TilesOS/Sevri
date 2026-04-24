import type { Plan } from "@/types/domain";

export const PLAN_LIMITS = {
  free: {
    generation_limit: 4,
    step_guidance: false,
    readme_export: false,
    calendar_export: false,
    portfolio_packaging: false,
    portfolio_export: false,
    portfolio_publish: false,
    portfolio_regenerate_curation: false,
    reviewer_limit: 0,
    link_github: false,
  },
  pro_monthly: {
    generation_limit: null,
    step_guidance: true,
    readme_export: true,
    calendar_export: true,
    portfolio_packaging: true,
    portfolio_export: true,
    portfolio_publish: true,
    portfolio_regenerate_curation: true,
    reviewer_limit: 2,
    link_github: true,
  },
} as const;

export function getGenerationLimit(plan: Plan) {
  return PLAN_LIMITS[plan].generation_limit;
}

export function hasUnlimitedGenerations(plan: Plan) {
  return getGenerationLimit(plan) === null;
}

export function canGenerateRecommendations(plan: Plan, generationsUsed: number) {
  const generationLimit = getGenerationLimit(plan);

  if (generationLimit === null) {
    return true;
  }

  return generationsUsed < generationLimit;
}

export function hasStepGuidanceAccess(plan: Plan) {
  return PLAN_LIMITS[plan].step_guidance;
}

export function hasReadmeExportAccess(plan: Plan) {
  return PLAN_LIMITS[plan].readme_export;
}

export function hasCalendarExportAccess(plan: Plan) {
  return PLAN_LIMITS[plan].calendar_export;
}

export function hasPortfolioPackagingAccess(plan: Plan) {
  return PLAN_LIMITS[plan].portfolio_packaging;
}

export function canGenerateExports(plan: Plan) {
  return PLAN_LIMITS[plan].portfolio_export;
}

export function canPublishPortfolio(plan: Plan) {
  return PLAN_LIMITS[plan].portfolio_publish;
}

export function canRegeneratePortfolioCuration(plan: Plan) {
  return PLAN_LIMITS[plan].portfolio_regenerate_curation;
}

export function reviewerLimit(plan: Plan): number {
  return PLAN_LIMITS[plan].reviewer_limit;
}

export function canInviteReviewer(plan: Plan, currentCount: number): boolean {
  return currentCount < reviewerLimit(plan);
}

export function canLinkGithub(plan: Plan): boolean {
  return PLAN_LIMITS[plan].link_github;
}
