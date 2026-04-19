import type { Plan } from "@/types/domain";

export const PLAN_LIMITS = {
  free: {
    generation_limit: 4,
    step_guidance: false,
    readme_export: false,
    portfolio_packaging: false,
    reviewer_limit: 0,
  },
  pro_monthly: {
    generation_limit: null,
    step_guidance: true,
    readme_export: true,
    portfolio_packaging: true,
    reviewer_limit: 2,
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

export function hasPortfolioPackagingAccess(plan: Plan) {
  return PLAN_LIMITS[plan].portfolio_packaging;
}

export function reviewerLimit(plan: Plan): number {
  return PLAN_LIMITS[plan].reviewer_limit;
}

export function canInviteReviewer(plan: Plan, currentCount: number): boolean {
  return currentCount < reviewerLimit(plan);
}
