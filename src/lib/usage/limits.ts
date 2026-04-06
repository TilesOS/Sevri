import type { Plan } from "@/types/domain";

export const PLAN_LIMITS = {
  free: {
    generation_limit: 2,
    step_guidance: false,
    readme_export: false,
    portfolio_packaging: false,
  },
  pro_monthly: {
    generation_limit: null,
    step_guidance: true,
    readme_export: true,
    portfolio_packaging: true,
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
